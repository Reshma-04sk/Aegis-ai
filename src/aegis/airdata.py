"""Open-Meteo geocoding, air-quality (CAMS model) and weather client with a TTL cache."""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

import httpx

from .models import AirSnapshot, HourlyPoint, Provenance, Weather

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

POLLUTANTS = (
    "pm2_5",
    "pm10",
    "nitrogen_dioxide",
    "ozone",
    "sulphur_dioxide",
    "carbon_monoxide",
)
_CURRENT_FIELDS = ["us_aqi", *POLLUTANTS, *(f"us_aqi_{p}" for p in POLLUTANTS)]
MAX_CACHE_ENTRIES = 256
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
RETRY_BACKOFF_SECONDS = 0.5
ATTEMPTS = 3
UNAVAILABLE = "The air-quality forecast service did not respond. Please try again in a minute."
STALE_AFTER_MINUTES = 180


class AirDataError(Exception):
    """Upstream air-quality service failed or returned unusable data."""


class LocationNotFoundError(AirDataError):
    """The place name could not be geocoded."""


class AirDataProvider(Protocol):
    """Source of air-quality snapshots (Open-Meteo in production, fakes in tests)."""

    async def snapshot(
        self, *, location: str | None, latitude: float | None, longitude: float | None
    ) -> AirSnapshot:
        """Return a snapshot for a place name or coordinates."""


async def get_json(
    http: httpx.AsyncClient,
    url: str,
    params: dict[str, Any],
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """GET a JSON object, retrying network errors and 429/5xx up to ATTEMPTS tries in all.

    Each try is time-bounded by the client timeout; the backoff grows 0.5 s, then 1 s.
    """
    try:
        for attempt in range(1, ATTEMPTS + 1):
            last = attempt == ATTEMPTS
            try:
                response = await http.get(url, params=params, headers=headers)
            except httpx.TransportError:
                if last:
                    raise
            else:
                if last or response.status_code not in RETRY_STATUSES:
                    break
            await asyncio.sleep(RETRY_BACKOFF_SECONDS * attempt)
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise AirDataError(UNAVAILABLE) from exc
    if not isinstance(data, dict):
        raise AirDataError("unexpected response from air quality service")
    return data


class TTLCache[T]:
    """Tiny bounded cache; the oldest entry is evicted first."""

    def __init__(self, ttl_seconds: int, max_entries: int = MAX_CACHE_ENTRIES) -> None:
        self._ttl = ttl_seconds
        self._max = max_entries
        self._items: dict[str, tuple[float, T]] = {}

    def get(self, key: str) -> T | None:
        """Return the live value for key, evicting it if expired."""
        entry = self._items.get(key)
        if entry is None:
            return None
        if time.monotonic() - entry[0] > self._ttl:
            del self._items[key]
            return None
        return entry[1]

    def pop(self, key: str) -> T | None:
        """Return and remove the live value for key (single use)."""
        value = self.get(key)
        self._items.pop(key, None)
        return value

    def put(self, key: str, value: T) -> None:
        """Store value under key, evicting the oldest entry when full."""
        if key not in self._items and len(self._items) >= self._max:
            self._items.pop(next(iter(self._items)))
        self._items[key] = (time.monotonic(), value)


class OpenMeteoClient:
    """Open-Meteo geocoding, CAMS air-quality and weather client with a TTL cache."""

    def __init__(self, client: httpx.AsyncClient, cache_ttl_seconds: int = 600) -> None:
        self._http = client
        self._places: TTLCache[tuple[str, float, float]] = TTLCache(cache_ttl_seconds * 6)
        self._air: TTLCache[AirSnapshot] = TTLCache(cache_ttl_seconds)

    async def _get_json(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        return await get_json(self._http, url, params)

    async def _geocode(self, name: str) -> tuple[str, float, float]:
        key = name.lower()
        cached = self._places.get(key)
        if cached:
            return cached
        data = await self._get_json(
            GEOCODE_URL, {"name": name, "count": 1, "language": "en", "format": "json"}
        )
        results = data.get("results") or []
        if not results:
            raise LocationNotFoundError(f"could not find a place called '{name}'")
        top = results[0]
        parts = [top.get("name"), top.get("admin1"), top.get("country")]
        place = (
            ", ".join(str(p) for p in parts if p),
            float(top["latitude"]),
            float(top["longitude"]),
        )
        self._places.put(key, place)
        return place

    async def _weather(self, latitude: float, longitude: float) -> dict[str, Any] | None:
        """Weather is explanatory only, so its failure never fails the request."""
        try:
            return await self._get_json(
                WEATHER_URL,
                {
                    "latitude": latitude,
                    "longitude": longitude,
                    "hourly": "wind_speed_10m,boundary_layer_height",
                    "forecast_days": 2,
                    "timezone": "auto",
                },
            )
        except AirDataError:
            return None

    async def snapshot(
        self, *, location: str | None, latitude: float | None, longitude: float | None
    ) -> AirSnapshot:
        """Geocode if needed, then fetch air quality and weather for the place."""
        if latitude is None or longitude is None:
            if not location:
                raise LocationNotFoundError("no location provided")
            label, latitude, longitude = await self._geocode(location)
        else:
            label = f"{latitude:.2f}, {longitude:.2f}"
        # Cache by coordinates only; the caller-specific label is applied per response.
        key = f"{latitude:.2f},{longitude:.2f}"
        snap = self._air.get(key)
        if snap is None:
            air, weather = await asyncio.gather(
                self._get_json(
                    AIR_URL,
                    {
                        "latitude": latitude,
                        "longitude": longitude,
                        "current": ",".join(_CURRENT_FIELDS),
                        "hourly": "us_aqi,pm2_5",
                        "forecast_days": 2,
                        "timezone": "auto",
                    },
                ),
                self._weather(latitude, longitude),
            )
            snap = parse_air_response(air, label, latitude, longitude, weather=weather)
            self._air.put(key, snap)
        return snap.model_copy(update={"location_name": label})


def _num(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None


def _provenance(observed: str, utc_offset_seconds: int, now: datetime) -> Provenance:
    try:
        local = datetime.fromisoformat(observed)
    except ValueError as exc:
        raise AirDataError("air quality data has no valid timestamp") from exc
    observed_utc = (local - timedelta(seconds=utc_offset_seconds)).replace(tzinfo=UTC)
    age = max(0, int((now - observed_utc).total_seconds() // 60))
    return Provenance(
        observed_at=observed,
        retrieved_at=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        data_age_minutes=age,
        stale=age > STALE_AFTER_MINUTES,
    )


def parse_weather(data: dict[str, Any] | None, hour_prefix: str) -> Weather | None:
    """Extract wind, boundary-layer height and today's peak mixing hour; None if absent."""
    hourly = (data or {}).get("hourly")
    if not isinstance(hourly, dict):
        return None
    times = [str(t) for t in hourly.get("time") or []]
    wind = hourly.get("wind_speed_10m") or []
    blh = hourly.get("boundary_layer_height") or []
    now_i = next((i for i, t in enumerate(times) if t[:13] == hour_prefix), None)
    if now_i is None:
        return None
    window = [(times[i], _num(blh[i])) for i in range(now_i, min(now_i + 24, len(times), len(blh)))]
    known = [(t, v) for t, v in window if v is not None]
    peak = max(known, key=lambda item: item[1], default=None)
    return Weather(
        wind_speed_kmh=_num(wind[now_i]) if now_i < len(wind) else None,
        boundary_layer_m=_num(blh[now_i]) if now_i < len(blh) else None,
        peak_mixing_time=peak[0] if peak else None,
        peak_boundary_layer_m=peak[1] if peak else None,
    )


def parse_air_response(
    data: dict[str, Any],
    label: str,
    latitude: float,
    longitude: float,
    *,
    weather: dict[str, Any] | None = None,
    now: datetime | None = None,
) -> AirSnapshot:
    """Convert Open-Meteo payloads into an AirSnapshot. Missing values stay missing."""
    current = data.get("current")
    if not isinstance(current, dict) or _num(current.get("us_aqi")) is None:
        raise AirDataError("no current air quality data for this location")
    hourly_raw = data.get("hourly") or {}
    times = hourly_raw.get("time") or []
    aqi_values = hourly_raw.get("us_aqi") or []
    pm_values = hourly_raw.get("pm2_5") or []
    hourly = [
        HourlyPoint(
            time=str(t),
            us_aqi=_num(aqi_values[i]) if i < len(aqi_values) else None,
            pm2_5=_num(pm_values[i]) if i < len(pm_values) else None,
        )
        for i, t in enumerate(times)
    ]
    observed = str(current.get("time", ""))
    hour_prefix = observed[:13]
    index = next((i for i, p in enumerate(hourly) if p.time[:13] == hour_prefix), 0)
    offset = data.get("utc_offset_seconds")
    return AirSnapshot(
        location_name=label,
        latitude=latitude,
        longitude=longitude,
        timezone=str(data.get("timezone", "UTC")),
        aqi=float(current["us_aqi"]),
        pollutants={p: _num(current.get(p)) for p in POLLUTANTS},
        sub_indices={p: _num(current.get(f"us_aqi_{p}")) for p in POLLUTANTS},
        hourly=hourly[index : index + 24],
        provenance=_provenance(
            observed, int(offset) if isinstance(offset, int) else 0, now or datetime.now(UTC)
        ),
        weather=parse_weather(weather, hour_prefix),
    )
