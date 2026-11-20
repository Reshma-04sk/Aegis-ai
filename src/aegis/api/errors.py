"""Error responses: the upstream-failure handler and the documented error shapes per route."""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi.responses import JSONResponse

from ..errors import LocationNotFoundError
from ..models import ErrorDetail

if TYPE_CHECKING:
    from fastapi import Request, Response

type Responses = dict[int | str, dict[str, object]]

# Documented in the OpenAPI schema so clients (and the API fuzz test) know every outcome.
_TOO_MANY: Responses = {
    429: {"model": ErrorDetail, "description": "Rate limit reached; see Retry-After"}
}
PLAN_ERRORS: Responses = {
    400: {"model": ErrorDetail, "description": "Body is not valid JSON"},
    404: {"model": ErrorDetail, "description": "Place not found"},
    502: {"model": ErrorDetail, "description": "Air-quality provider unavailable"},
    **_TOO_MANY,
}
BRIEFING_ERRORS: Responses = {
    404: {"model": ErrorDetail, "description": "Briefing expired or already used"},
    **_TOO_MANY,
}


async def air_error(_: Request, exc: Exception) -> Response:
    """Map upstream air-data failures to 404 (unknown place) or 502 (provider down)."""
    status = 404 if isinstance(exc, LocationNotFoundError) else 502
    return JSONResponse({"detail": str(exc)}, status_code=status)
