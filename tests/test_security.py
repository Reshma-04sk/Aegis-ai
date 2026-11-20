import pytest

from aegis.config import DEFAULT_MODEL, Settings
from aegis.security import RateLimiter, client_ip


def test_rate_limiter_blocks_then_recovers(monkeypatch):
    now = [0.0]
    monkeypatch.setattr("aegis.security.time.monotonic", lambda: now[0])
    limiter = RateLimiter(limit=2, window_seconds=60)
    assert limiter.check("a") == 0 and limiter.check("a") == 0
    assert limiter.check("a") > 0
    assert limiter.check("b") == 0  # other clients unaffected
    now[0] = 61
    assert limiter.check("a") == 0


def test_rate_limiter_prunes_idle_clients(monkeypatch):
    now = [0.0]
    monkeypatch.setattr("aegis.security.time.monotonic", lambda: now[0])
    limiter = RateLimiter(limit=5, window_seconds=10, max_clients=2)
    limiter.check("a")
    limiter.check("b")
    now[0] = 50
    limiter.check("c")
    assert set(limiter._hits) == {"c"}


def test_rate_limiter_hard_bound_when_all_active(monkeypatch):
    monkeypatch.setattr("aegis.security.time.monotonic", lambda: 1.0)
    limiter = RateLimiter(limit=5, window_seconds=60, max_clients=2)
    for key in ("a", "b", "c", "d"):
        limiter.check(key)
    assert set(limiter._hits) == {"c", "d"}


@pytest.mark.parametrize(
    ("peer", "xff", "hops", "expected"),
    [
        ("10.0.0.1", "6.6.6.6", 0, "10.0.0.1"),  # no trusted proxy: ignore header
        ("10.0.0.1", "6.6.6.6, 203.0.113.9", 1, "203.0.113.9"),  # spoofed left entry ignored
        ("10.0.0.1", "203.0.113.9", 2, "10.0.0.1"),  # too few hops: fall back
        ("10.0.0.1", "not-an-ip", 1, "10.0.0.1"),
        (None, None, 1, "unknown"),
    ],
)
def test_client_ip(peer, xff, hops, expected):
    assert client_ip(peer, xff, hops) == expected


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", " secret ")
    monkeypatch.setenv("GEMINI_MODEL", " ")
    monkeypatch.setenv("CACHE_TTL_SECONDS", "abc")
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "5")
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    settings = Settings.from_env()
    assert settings.gemini_api_key == "secret" and settings.gemini_model == DEFAULT_MODEL
    assert settings.cache_ttl_seconds == 600 and settings.rate_limit_per_minute == 5
    assert settings.trusted_proxy_hops == 1
