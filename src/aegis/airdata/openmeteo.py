"""Open-Meteo client: geocoding, CAMS air quality and weather, each cached with a TTL."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

from ..cache import TTLCache
from ..errors import AirDataError, LocationNotFoundError
from ..fetch import get_json
from .parse import POLLUTANTS, parse_air_response

if TYPE_CHECKING:
    import httpx

    from ..models import AirSnapshot

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
CURRENT_FIELDS = ",".join(["us_aqi", *POLLUTANTS, *(f"us_aqi_{p}" for p in POLLUTANTS)])
FORECAST = {"forecast_days": 2, "timezone": "auto"}

type Place = tuple[str, float, float]


class OpenMeteoClient:
    """Implements AirDataProvider against the public Open-Meteo APIs."""

    def __init__(self, client: httpx.AsyncClient, cache_ttl_seconds: int = 600) -> None:
        self._http = client
        self._places: TTLCache[Place] = TTLCache(cache_ttl_seconds * 6)
        self._air: TTLCache[AirSnapshot] = TTLCache(cache_ttl_seconds)

    async def _get_json(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        return await get_json(self._http, url, params)

    async def _geocode(self, name: str) -> Place:
        """Best match for a place name, as (label, latitude, longitude)."""
        key = name.lower()
        if cached := self._places.get(key):
            return cached
        data = await self._get_json(
            GEOCODE_URL, {"name": name, "count": 1, "language": "en", "format": "json"}
        )
        results = data.get("results") or []
        if not results:
            raise LocationNotFoundError(f"could not find a place called '{name}'")
        top = results[0]
        parts = (top.get("name"), top.get("admin1"), top.get("country"))
        place = (
            ", ".join(str(p) for p in parts if p),
            float(top["latitude"]),
            float(top["longitude"]),
        )
        self._places.put(key, place)
        return place

    async def _weather(self, latitude: float, longitude: float) -> dict[str, Any] | None:
        """Weather is explanatory only, so its failure never fails the request."""
        hourly = "wind_speed_10m,boundary_layer_height"
        params = {"latitude": latitude, "longitude": longitude, "hourly": hourly, **FORECAST}
        try:
            return await self._get_json(WEATHER_URL, params)
        except AirDataError:
            return None

    async def _fetch(self, place: Place) -> AirSnapshot:
        """Air quality and weather in parallel, parsed into one snapshot."""
        _, latitude, longitude = place
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": CURRENT_FIELDS,
            "hourly": "us_aqi,pm2_5",
            **FORECAST,
        }
        air, weather = await asyncio.gather(
            self._get_json(AIR_URL, params), self._weather(latitude, longitude)
        )
        return parse_air_response(air, place, weather=weather)

    async def _resolve(
        self, location: str | None, latitude: float | None, longitude: float | None
    ) -> Place:
        """Coordinates win over a name; a name is geocoded."""
        if latitude is not None and longitude is not None:
            return (f"{latitude:.2f}, {longitude:.2f}", latitude, longitude)
        if not location:
            raise LocationNotFoundError("no location provided")
        return await self._geocode(location)

    async def snapshot(
        self, *, location: str | None, latitude: float | None, longitude: float | None
    ) -> AirSnapshot:
        """Snapshot cached by coordinates; the caller's own label is applied per response."""
        place = await self._resolve(location, latitude, longitude)
        key = f"{place[1]:.2f},{place[2]:.2f}"
        snap = self._air.get(key)
        if snap is None:
            snap = await self._fetch(place)
            self._air.put(key, snap)
        return snap.model_copy(update={"location_name": place[0]})
