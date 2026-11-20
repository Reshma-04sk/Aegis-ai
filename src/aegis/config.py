"""Runtime configuration, read once from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass

DEFAULT_MODEL = "gemini-3.5-flash-lite"


def _int(name: str, default: int, minimum: int = 1) -> int:
    try:
        return max(minimum, int(os.environ.get(name, default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    """Runtime settings, read from environment variables."""

    gemini_api_key: str = ""
    openaq_api_key: str = ""
    gemini_model: str = DEFAULT_MODEL
    gemini_calls_per_minute: int = 60
    cache_ttl_seconds: int = 600
    rate_limit_per_minute: int = 30
    request_timeout_seconds: int = 8
    trusted_proxy_hops: int = 0

    @classmethod
    def from_env(cls) -> Settings:
        """Build settings from the environment, falling back to safe defaults."""
        return cls(
            gemini_api_key=os.environ.get("GEMINI_API_KEY", "").strip(),
            openaq_api_key=os.environ.get("OPENAQ_API_KEY", "").strip(),
            gemini_model=os.environ.get("GEMINI_MODEL", "").strip() or DEFAULT_MODEL,
            gemini_calls_per_minute=_int("GEMINI_CALLS_PER_MINUTE", 60),
            cache_ttl_seconds=_int("CACHE_TTL_SECONDS", 600),
            rate_limit_per_minute=_int("RATE_LIMIT_PER_MINUTE", 30),
            request_timeout_seconds=_int("REQUEST_TIMEOUT_SECONDS", 8),
            trusted_proxy_hops=_int("TRUSTED_PROXY_HOPS", 0, minimum=0),
        )
