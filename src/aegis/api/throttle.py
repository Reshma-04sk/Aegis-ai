"""Per-client rate limiting, applied to every API route as a dependency."""

from __future__ import annotations

from fastapi import HTTPException, Request

from ..security import client_ip
from .services import ServicesDep


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
