"""Choose the nearest monitoring station that has reported within the last day."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .geo import haversine_km
from .values import age_minutes

if TYPE_CHECKING:
    from datetime import datetime

RECENT_MINUTES = 24 * 60  # a station silent for a day is not "current"


def _coordinates(loc: dict[str, Any]) -> tuple[float, float] | None:
    """The location's numeric latitude and longitude, if both are present."""
    coords = loc.get("coordinates") or {}
    lat, lon = coords.get("latitude"), coords.get("longitude")
    if isinstance(lat, int | float) and isinstance(lon, int | float):
        return float(lat), float(lon)
    return None


def _is_recent(loc: dict[str, Any], now: datetime) -> bool:
    """True when the location's last report is known and under a day old."""
    age = age_minutes((loc.get("datetimeLast") or {}).get("utc"), now)
    return age is not None and age <= RECENT_MINUTES


def pick_station(
    locations: list[dict[str, Any]], latitude: float, longitude: float, now: datetime
) -> tuple[dict[str, Any], float] | None:
    """Nearest recent location with its distance in km, or None."""
    candidates = [
        (loc, haversine_km(latitude, longitude, *coords))
        for loc in locations
        if (coords := _coordinates(loc)) and _is_recent(loc, now)
    ]
    return min(candidates, key=lambda item: item[1], default=None)
