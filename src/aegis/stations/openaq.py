"""OpenAQ v3 adapter for the nearest reference monitor (measured data, not a forecast).

Station values are returned as their own object with their own provenance. They never replace
or adjust the CAMS model estimate, and missing or invalid values stay missing.
Docs: https://docs.openaq.org (auth header X-API-Key; radius max 25 km).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from ..cache import TTLCache
from ..errors import AirDataError
from ..fetch import get_json
from .geo import haversine_km
from .observation import build_observation
from .select import pick_station

if TYPE_CHECKING:
    import httpx

    from ..models import StationObservation, StationStatus

OPENAQ_URL = "https://api.openaq.org/v3"
SEARCH_RADIUS_M = 25_000
PM25_PARAMETER_ID = 2
MAX_LOCATIONS = 100  # OpenAQ default page size; nearest is chosen client-side

type StationLookup = tuple[StationObservation | None, StationStatus]
# Raw OpenAQ rows for one area; (None, []) records "no recent station nearby".
type RawStation = tuple[dict[str, Any] | None, list[dict[str, Any]]]
# Upstream JSON is untrusted: any shape surprise means "unavailable", never a failed plan.
_BAD_PAYLOAD = (AirDataError, LookupError, TypeError, ValueError, AttributeError, OverflowError)


class OpenAQClient:
    """Nearest reporting monitor; never raises, because station data only adds context."""

    def __init__(self, client: httpx.AsyncClient, api_key: str, cache_ttl_seconds: int) -> None:
        self._http = client
        self._headers = {"X-API-Key": api_key}
        self._enabled = bool(api_key)
        self._cache: TTLCache[RawStation] = TTLCache(cache_ttl_seconds)

    async def nearest(self, latitude: float, longitude: float) -> StationLookup:
        """Raw rows are cached; distance and data age are recomputed for every caller."""
        if not self._enabled:
            return None, "not_configured"
        try:
            loc, latest = await self._cached(latitude, longitude)
            if loc is None:
                return None, "none_nearby"
            coords = loc["coordinates"]
            distance = haversine_km(latitude, longitude, coords["latitude"], coords["longitude"])
            observation = build_observation(loc, distance, latest, datetime.now(UTC))
        except _BAD_PAYLOAD:
            return None, "unavailable"
        return (observation, "ok") if observation else (None, "none_nearby")

    async def _cached(self, latitude: float, longitude: float) -> RawStation:
        """Raw rows for the ~1 km cell around the point, fetched once per TTL."""
        key = f"{latitude:.2f},{longitude:.2f}"
        raw = self._cache.get(key)
        if raw is None:
            raw = await self._fetch(latitude, longitude)
            self._cache.put(key, raw)
        return raw

    async def _fetch(self, latitude: float, longitude: float) -> RawStation:
        """Find reference monitors in range, pick the nearest recent one, read its latest rows."""
        params = {
            "coordinates": f"{latitude:.4f},{longitude:.4f}",
            "radius": SEARCH_RADIUS_M,
            "parameters_id": PM25_PARAMETER_ID,
            "monitor": "true",  # reference-grade monitors only, not low-cost sensors
            "limit": MAX_LOCATIONS,
        }
        found = await get_json(self._http, f"{OPENAQ_URL}/locations", params, self._headers)
        picked = pick_station(found.get("results") or [], latitude, longitude, datetime.now(UTC))
        if picked is None:
            return None, []
        url = f"{OPENAQ_URL}/locations/{int(picked[0]['id'])}/latest"
        latest = await get_json(self._http, url, {}, self._headers)
        return picked[0], latest.get("results") or []
