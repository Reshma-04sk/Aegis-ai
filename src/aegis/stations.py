"""Nearest monitoring-station readings from OpenAQ v3 (measured data, not a forecast).

Station values are returned as their own object with their own provenance. They never replace
or adjust the CAMS model estimate, and missing or invalid values stay missing.
Docs: https://docs.openaq.org (auth header X-API-Key; radius max 25 km).
"""

from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from .airdata import STALE_AFTER_MINUTES, AirDataError, TTLCache, get_json
from .models import StationObservation, StationReading, StationStatus

if TYPE_CHECKING:
    import httpx

OPENAQ_URL = "https://api.openaq.org/v3"
SEARCH_RADIUS_M = 25_000
PM25_PARAMETER_ID = 2
RECENT_MINUTES = 24 * 60  # a station silent for a day is not "current"
MAX_LOCATIONS = 100  # OpenAQ default page size; nearest is chosen client-side
FUTURE_SKEW_MINUTES = 5
# Display order; other parameters a station reports are left out.
POLLUTANT_ORDER = ("pm25", "pm10", "no2", "o3", "so2", "co")
EARTH_RADIUS_KM = 6371.0088

StationLookup = tuple[StationObservation | None, StationStatus]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _age_minutes(utc: object, now: datetime) -> int | None:
    if not isinstance(utc, str):
        return None
    try:
        when = datetime.fromisoformat(utc)
    except ValueError:
        return None
    if when.tzinfo is None:
        return None
    minutes = int((now - when).total_seconds() // 60)
    if minutes < -FUTURE_SKEW_MINUTES:
        return None  # a timestamp in the future is unknown, not fresh
    return max(0, minutes)


def _value(raw: object) -> float | None:
    """Negative sentinels (e.g. -999), NaN and infinity mean no data; those stay missing."""
    if isinstance(raw, bool) or not isinstance(raw, int | float):
        return None
    if not math.isfinite(raw) or raw < 0:
        return None
    return float(raw)


def pick_station(
    locations: list[dict[str, Any]], latitude: float, longitude: float, now: datetime
) -> tuple[dict[str, Any], float] | None:
    """Nearest location that reported within the last day."""
    best: tuple[dict[str, Any], float] | None = None
    for loc in locations:
        coords = loc.get("coordinates") or {}
        lat, lon = coords.get("latitude"), coords.get("longitude")
        if not isinstance(lat, int | float) or not isinstance(lon, int | float):
            continue
        age = _age_minutes((loc.get("datetimeLast") or {}).get("utc"), now)
        if age is None or age > RECENT_MINUTES:
            continue
        distance = haversine_km(latitude, longitude, lat, lon)
        if best is None or distance < best[1]:
            best = (loc, distance)
    return best


def _attribution(loc: dict[str, Any], provider: str) -> str:
    names = [
        lic["attribution"]["name"]
        for lic in loc.get("licenses") or []
        if isinstance(lic.get("attribution"), dict) and lic["attribution"].get("name")
    ]
    return f"Measurements by {', '.join(names) or provider}, via OpenAQ (openaq.org)."


def build_observation(
    loc: dict[str, Any], distance: float, latest: list[dict[str, Any]], now: datetime
) -> StationObservation | None:
    """Build a station observation from OpenAQ rows, keeping only fresh valid readings."""
    provider = str((loc.get("provider") or {}).get("name") or "Unknown provider")
    sensors = {
        s["id"]: s["parameter"]
        for s in loc.get("sensors") or []
        if isinstance(s.get("parameter"), dict) and "id" in s
    }
    retrieved = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    readings: dict[str, StationReading] = {}
    for item in latest:
        parameter = sensors.get(item.get("sensorsId"))
        if not parameter or parameter.get("name") not in POLLUTANT_ORDER:
            continue
        observed = (item.get("datetime") or {}).get("utc")
        age = _age_minutes(observed, now)
        if age is not None and age > RECENT_MINUTES:
            continue  # a sensor silent for over a day has no current reading
        previous = readings.get(parameter["name"])
        previous_age = previous.data_age_minutes if previous else None
        if previous_age is not None and (age is None or age >= previous_age):
            continue  # two sensors for one pollutant: keep the freshest
        readings[parameter["name"]] = StationReading(
            station_id=int(loc["id"]),
            provider=provider,
            pollutant=parameter["name"],
            label=str(parameter.get("displayName") or parameter["name"]),
            value=_value(item.get("value")),
            unit=str(parameter.get("units") or ""),
            observed_at=observed if age is not None else None,
            retrieved_at=retrieved,
            data_age_minutes=age,
            stale=age is None or age > STALE_AFTER_MINUTES,
        )
    if not readings:
        return None
    return StationObservation(
        station_id=int(loc["id"]),
        station_name=str(loc.get("name") or f"Station {loc['id']}"),
        provider=provider,
        is_reference_monitor=bool(loc.get("isMonitor")),
        distance_km=round(distance, 1),
        readings=[readings[p] for p in POLLUTANT_ORDER if p in readings],
        attribution=_attribution(loc, provider),
    )


# Raw OpenAQ rows for one area; (None, []) records "no recent station nearby".
RawStation = tuple[dict[str, Any] | None, list[dict[str, Any]]]
# Upstream JSON is untrusted: any shape surprise means "unavailable", never a failed plan.
_BAD_PAYLOAD = (AirDataError, LookupError, TypeError, ValueError, AttributeError, OverflowError)


class OpenAQClient:
    """OpenAQ v3 client for the nearest reporting monitor; never raises."""

    def __init__(self, client: httpx.AsyncClient, api_key: str, cache_ttl_seconds: int) -> None:
        self._http = client
        self._headers = {"X-API-Key": api_key}
        self._enabled = bool(api_key)
        self._cache: TTLCache[RawStation] = TTLCache(cache_ttl_seconds)

    async def nearest(self, latitude: float, longitude: float) -> StationLookup:
        """Never raises: station data only adds context, so its failure never fails a plan.

        Raw rows are cached; distance and data age are recomputed for every caller.
        """
        if not self._enabled:
            return None, "not_configured"
        key = f"{latitude:.2f},{longitude:.2f}"
        try:
            raw = self._cache.get(key)
            if raw is None:
                raw = await self._fetch(latitude, longitude)
                self._cache.put(key, raw)
            loc, latest = raw
            if loc is None:
                return None, "none_nearby"
            coords = loc["coordinates"]
            distance = haversine_km(latitude, longitude, coords["latitude"], coords["longitude"])
            observation = build_observation(loc, distance, latest, datetime.now(UTC))
        except _BAD_PAYLOAD:
            return None, "unavailable"
        return (observation, "ok") if observation else (None, "none_nearby")

    async def _fetch(self, latitude: float, longitude: float) -> RawStation:
        found = await get_json(
            self._http,
            f"{OPENAQ_URL}/locations",
            {
                "coordinates": f"{latitude:.4f},{longitude:.4f}",
                "radius": SEARCH_RADIUS_M,
                "parameters_id": PM25_PARAMETER_ID,
                "monitor": "true",  # reference-grade monitors only, not low-cost sensors
                "limit": MAX_LOCATIONS,
            },
            self._headers,
        )
        picked = pick_station(found.get("results") or [], latitude, longitude, datetime.now(UTC))
        if picked is None:
            return None, []
        loc = picked[0]
        latest = await get_json(
            self._http, f"{OPENAQ_URL}/locations/{int(loc['id'])}/latest", {}, self._headers
        )
        return loc, latest.get("results") or []
