"""HTTP middleware: security and cache headers, a request id, one JSON log line per API call."""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from typing import TYPE_CHECKING

from ..security import SECURITY_HEADERS

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from fastapi import Request, Response

_REQUEST_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")
log = logging.getLogger("aegis")


def _log(**fields: object) -> None:
    """Write one JSON line per event; never includes request bodies or secrets."""
    log.info(json.dumps(fields, separators=(",", ":")))


def _request_id(request: Request) -> str:
    """The caller's id when it is well formed, otherwise a fresh one."""
    incoming = request.headers.get("x-request-id", "")
    return incoming if _REQUEST_ID.match(incoming) else uuid.uuid4().hex


async def observe(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Add security and cache headers and a request id; log API calls."""
    request_id = _request_id(request)
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
