"""Security helpers: response headers, client identity and a bounded rate limiter."""

from __future__ import annotations

import ipaddress
import time
from collections import deque

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; "
        "connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; "
        "object-src 'none'; require-trusted-types-for 'script'; trusted-types 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": (
        "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), browsing-topics=()"
    ),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    # Every resource is same-origin with CORP, so the page can be fully cross-origin isolated.
    "Cross-Origin-Embedder-Policy": "require-corp",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}

MAX_TRACKED_CLIENTS = 10_000


def client_ip(peer: str | None, forwarded_for: str | None, trusted_hops: int) -> str:
    """Identify the caller without trusting spoofable headers.

    With ``trusted_hops`` = N, the N-th entry from the right of X-Forwarded-For is used:
    entries to its left are client-supplied and ignored. With 0, the TCP peer is used.
    """
    if trusted_hops > 0 and forwarded_for:
        hops = [h.strip() for h in forwarded_for.split(",") if h.strip()]
        if len(hops) >= trusted_hops:
            candidate = hops[-trusted_hops]
            try:
                return str(ipaddress.ip_address(candidate))
            except ValueError:
                pass
    return peer or "unknown"


class RateLimiter:
    """Sliding-window limiter keyed by client id (in memory, per process, hard-bounded)."""

    def __init__(
        self, limit: int, window_seconds: float = 60.0, max_clients: int = MAX_TRACKED_CLIENTS
    ) -> None:
        self._limit = limit
        self._window = window_seconds
        self._max = max_clients
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> float:
        """Record a hit. Returns 0 if allowed, otherwise seconds until retry."""
        now = time.monotonic()
        if key not in self._hits and len(self._hits) >= self._max:
            self._prune(now)
            while len(self._hits) >= self._max:  # all active: evict the oldest client
                self._hits.pop(next(iter(self._hits)))
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] >= self._window:
            hits.popleft()
        if len(hits) >= self._limit:
            return max(1.0, self._window - (now - hits[0]))
        hits.append(now)
        return 0.0

    def _prune(self, now: float) -> None:
        stale = [k for k, h in self._hits.items() if not h or now - h[-1] >= self._window]
        for key in stale:
            del self._hits[key]
