"""The per-app service container and the FastAPI dependency that hands it to routes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Annotated, cast

from fastapi import Depends, Request

from ..advisor import GeminiAdvisor
from ..airdata import OpenMeteoClient
from ..cache import TTLCache
from ..security import RateLimiter
from ..stations import OpenAQClient

if TYPE_CHECKING:
    import httpx

    from ..advisor import Advisor
    from ..airdata import AirDataProvider
    from ..config import Settings
    from ..models import PlanResponse
    from ..stations import StationProvider

BRIEFING_TTL_SECONDS = 300


@dataclass(frozen=True, slots=True)
class Overrides:
    """Providers a caller (usually a test) supplies instead of the real adapters."""

    air: AirDataProvider | None = None
    advisor: Advisor | None = None
    stations: StationProvider | None = None


@dataclass(frozen=True, slots=True)
class Services:
    """Everything a request needs, built once per app at startup."""

    settings: Settings
    limiter: RateLimiter
    pending: TTLCache[tuple[PlanResponse, str | None]]
    air: AirDataProvider
    stations: StationProvider
    advisor: Advisor


def build_services(settings: Settings, http: httpx.AsyncClient, given: Overrides) -> Services:
    """Wire the real adapters, keeping any override the caller supplied."""
    ttl = settings.cache_ttl_seconds
    return Services(
        settings=settings,
        limiter=RateLimiter(settings.rate_limit_per_minute),
        pending=TTLCache(BRIEFING_TTL_SECONDS),
        air=given.air or OpenMeteoClient(http, ttl),
        stations=given.stations or OpenAQClient(http, settings.openaq_api_key, ttl),
        advisor=given.advisor
        or GeminiAdvisor(
            settings.gemini_api_key, settings.gemini_model, http, settings.gemini_calls_per_minute
        ),
    )


def get_services(request: Request) -> Services:
    """Return the app's services (a FastAPI dependency)."""
    return cast("Services", request.app.state.services)


ServicesDep = Annotated[Services, Depends(get_services)]
