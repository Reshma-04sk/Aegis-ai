"""FastAPI application: JSON API plus the static accessible front end."""

from __future__ import annotations

import json
import logging
import re
import secrets
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Annotated, Protocol, cast

import httpx
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .advisor import Advisor, GeminiAdvisor, rules_briefing
from .airdata import (
    AirDataError,
    AirDataProvider,
    LocationNotFoundError,
    OpenMeteoClient,
    TTLCache,
)
from .config import Settings
from .models import Briefing, ErrorDetail, PlanRequest, PlanResponse
from .pages import TEMPLATES, page_context
from .security import SECURITY_HEADERS, RateLimiter, client_ip
from .service import build_plan
from .stations import OpenAQClient, StationLookup

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator, Awaitable, Callable

STATIC_DIR = Path(__file__).parent / "static"
BRIEFING_TTL_SECONDS = 300
_REQUEST_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")
log = logging.getLogger("aegis")


class StationProvider(Protocol):
    """Finds the nearest monitoring station; never raises (see stations.OpenAQClient)."""

    async def nearest(self, latitude: float, longitude: float) -> StationLookup:
        """Return the nearest station observation and a status."""


@dataclass(frozen=True, slots=True)
class Services:
    """Everything a request needs, built once per app at startup."""

    settings: Settings
    limiter: RateLimiter
    pending: TTLCache[tuple[PlanResponse, str | None]]
    air: AirDataProvider
    stations: StationProvider
    advisor: Advisor


def _log(**fields: object) -> None:
    """Write one JSON line per event; never includes request bodies or secrets."""
    log.info(json.dumps(fields, separators=(",", ":")))


def get_services(request: Request) -> Services:
    """Return the app's services (a FastAPI dependency)."""
    return cast("Services", request.app.state.services)


ServicesDep = Annotated[Services, Depends(get_services)]


def throttle(request: Request, svc: ServicesDep) -> None:
    """Reject the request with 429 when its client is over the per-minute limit."""
    peer = request.client.host if request.client else None
    who = client_ip(peer, request.headers.get("x-forwarded-for"), svc.settings.trusted_proxy_hops)
    retry_after = svc.limiter.check(who)
    if retry_after:
        raise HTTPException(
            429,
            "too many requests, please slow down",
            headers={"Retry-After": str(int(retry_after))},
        )


async def observe(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Add security and cache headers and a request id; log API calls."""
    incoming = request.headers.get("x-request-id", "")
    request_id = incoming if _REQUEST_ID.match(incoming) else uuid.uuid4().hex
    started = time.perf_counter()
    response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    response.headers["X-Request-ID"] = request_id
    if not request.url.path.startswith("/api/"):
        # Revalidate the page and assets (cheap via ETag) so a deploy is never served stale.
        response.headers["Cache-Control"] = "no-cache"
        return response
    response.headers["Cache-Control"] = "no-store"
    _log(
        event="request",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        ms=round((time.perf_counter() - started) * 1000, 1),
    )
    return response


async def air_error(_: Request, exc: Exception) -> Response:
    """Map upstream air-data failures to 404 (unknown place) or 502 (provider down)."""
    status = 404 if isinstance(exc, LocationNotFoundError) else 502
    return JSONResponse({"detail": str(exc)}, status_code=status)


router = APIRouter()

# Documented in the OpenAPI schema so clients (and the API fuzz test) know every outcome.
_TOO_MANY: dict[int | str, dict[str, object]] = {
    429: {"model": ErrorDetail, "description": "Rate limit reached; see Retry-After"}
}
PLAN_ERRORS: dict[int | str, dict[str, object]] = {
    400: {"model": ErrorDetail, "description": "Body is not valid JSON"},
    404: {"model": ErrorDetail, "description": "Place not found"},
    502: {"model": ErrorDetail, "description": "Air-quality provider unavailable"},
    **_TOO_MANY,
}
BRIEFING_ERRORS: dict[int | str, dict[str, object]] = {
    404: {"model": ErrorDetail, "description": "Briefing expired or already used"},
    **_TOO_MANY,
}


@router.get("/api/health")
async def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}


@router.post("/api/plan", dependencies=[Depends(throttle)], responses=PLAN_ERRORS)
async def plan(body: PlanRequest, svc: ServicesDep) -> PlanResponse:
    """Deterministic plan, returned at once with a rule-based briefing."""
    snapshot = await svc.air.snapshot(
        location=body.location, latitude=body.latitude, longitude=body.longitude
    )
    station = await svc.stations.nearest(snapshot.latitude, snapshot.longitude)
    result = build_plan(snapshot, body, station)
    briefing_id = secrets.token_urlsafe(16)
    svc.pending.put(briefing_id, (result, body.note))
    return result.model_copy(
        update={"explanation": rules_briefing(result), "briefing_id": briefing_id}
    )


@router.post(
    "/api/briefing/{briefing_id}", dependencies=[Depends(throttle)], responses=BRIEFING_ERRORS
)
async def briefing(briefing_id: str, svc: ServicesDep) -> Briefing:
    """Single-use AI briefing for a plan created in the last few minutes."""
    entry = svc.pending.pop(briefing_id)
    if entry is None:
        raise HTTPException(404, "briefing expired, please plan again")
    result, note = entry
    text, source = await svc.advisor.explain(result, note)
    return Briefing(explanation=text, explanation_source=source)


@router.get("/", include_in_schema=False)
async def index(request: Request) -> HTMLResponse:
    """Landing page."""
    return TEMPLATES.TemplateResponse(request, "index.html", page_context())


@router.get("/plan", include_in_schema=False)
async def planner(request: Request) -> HTMLResponse:
    """Planner page."""
    return TEMPLATES.TemplateResponse(request, "plan.html", page_context())


def create_app(
    settings: Settings | None = None,
    air: AirDataProvider | None = None,
    advisor: Advisor | None = None,
    stations: StationProvider | None = None,
) -> FastAPI:
    """Build the app. Tests pass fakes for the upstream providers."""
    settings = settings or Settings.from_env()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        timeout = httpx.Timeout(settings.request_timeout_seconds, connect=4)
        async with httpx.AsyncClient(timeout=timeout, headers={"User-Agent": "aegis-ai"}) as http:
            app.state.services = Services(
                settings=settings,
                limiter=RateLimiter(settings.rate_limit_per_minute),
                pending=TTLCache(BRIEFING_TTL_SECONDS),
                air=air or OpenMeteoClient(http, settings.cache_ttl_seconds),
                stations=stations
                or OpenAQClient(http, settings.openaq_api_key, settings.cache_ttl_seconds),
                advisor=advisor
                or GeminiAdvisor(
                    settings.gemini_api_key,
                    settings.gemini_model,
                    http,
                    settings.gemini_calls_per_minute,
                ),
            )
            yield

    app = FastAPI(title="AEGIS", version="2.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    # Plan JSON and app.js are several KB; compress anything over 1 KB.
    app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=6)
    app.middleware("http")(observe)
    app.add_exception_handler(AirDataError, air_error)
    app.include_router(router)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    return app


app = create_app()
