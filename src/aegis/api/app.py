"""Application factory: wires services, middleware, error handling, routes and static files."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import httpx
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from ..config import Settings
from ..errors import AirDataError
from . import pages, routes
from .errors import air_error
from .middleware import observe
from .pages import STATIC_DIR
from .services import Overrides, build_services

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator, Callable
    from contextlib import AbstractAsyncContextManager

type Lifespan = Callable[[FastAPI], AbstractAsyncContextManager[None]]


def _lifespan(settings: Settings, given: Overrides) -> Lifespan:
    """One shared, time-bounded HTTP client for the app's lifetime."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        timeout = httpx.Timeout(settings.request_timeout_seconds, connect=4)
        async with httpx.AsyncClient(timeout=timeout, headers={"User-Agent": "aegis-ai"}) as http:
            app.state.services = build_services(settings, http, given)
            yield

    return lifespan


def create_app(settings: Settings | None = None, given: Overrides | None = None) -> FastAPI:
    """Build the app. Tests pass Overrides with fakes for the upstream providers."""
    settings = settings or Settings.from_env()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    lifespan = _lifespan(settings, given or Overrides())
    app = FastAPI(title="AEGIS", version="2.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    # Plan JSON and the script bundles are several KB; compress anything over 1 KB.
    app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=6)
    app.middleware("http")(observe)
    app.add_exception_handler(AirDataError, air_error)
    app.include_router(routes.router)
    app.include_router(pages.router)
    # check_dir=False: the API runs (and its tests pass) before the front end has been built.
    app.mount("/static", StaticFiles(directory=STATIC_DIR, check_dir=False), name="static")
    return app
