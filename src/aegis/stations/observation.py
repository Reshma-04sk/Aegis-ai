"""Build a measured StationObservation from OpenAQ rows, keeping only fresh, valid readings."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..freshness import STALE_AFTER_MINUTES
from ..models import StationObservation, StationReading
from .select import RECENT_MINUTES
from .values import age_minutes, measured_value

if TYPE_CHECKING:
    from datetime import datetime

# Display order; other parameters a station reports are left out.
POLLUTANT_ORDER = ("pm25", "pm10", "no2", "o3", "so2", "co")


def _provider(loc: dict[str, Any]) -> str:
    """The network operating the station."""
    return str((loc.get("provider") or {}).get("name") or "Unknown provider")


def _attribution(loc: dict[str, Any], provider: str) -> str:
    """Credit line naming each data licence holder, or the provider."""
    names = [
        lic["attribution"]["name"]
        for lic in loc.get("licenses") or []
        if isinstance(lic.get("attribution"), dict) and lic["attribution"].get("name")
    ]
    return f"Measurements by {', '.join(names) or provider}, via OpenAQ (openaq.org)."


def _sensors(loc: dict[str, Any]) -> dict[Any, dict[str, Any]]:
    """Sensor id to parameter description, for the pollutants we display."""
    return {
        s["id"]: s["parameter"]
        for s in loc.get("sensors") or []
        if isinstance(s.get("parameter"), dict)
        and "id" in s
        and s["parameter"].get("name") in POLLUTANT_ORDER
    }


def _reading(
    loc: dict[str, Any], parameter: dict[str, Any], item: dict[str, Any], now: datetime
) -> StationReading | None:
    """One reading with provenance; None when the sensor has been silent for over a day."""
    observed = (item.get("datetime") or {}).get("utc")
    age = age_minutes(observed, now)
    if age is not None and age > RECENT_MINUTES:
        return None
    return StationReading(
        station_id=int(loc["id"]),
        provider=_provider(loc),
        pollutant=parameter["name"],
        label=str(parameter.get("displayName") or parameter["name"]),
        value=measured_value(item.get("value")),
        unit=str(parameter.get("units") or ""),
        observed_at=observed if age is not None else None,
        retrieved_at=now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        data_age_minutes=age,
        stale=age is None or age > STALE_AFTER_MINUTES,
    )


def _fresher(new: StationReading, old: StationReading | None) -> bool:
    """Two sensors for one pollutant: the one with a known, smaller age wins."""
    if old is None or old.data_age_minutes is None:
        return True
    return new.data_age_minutes is not None and new.data_age_minutes < old.data_age_minutes


def build_observation(
    loc: dict[str, Any], distance: float, latest: list[dict[str, Any]], now: datetime
) -> StationObservation | None:
    """The station's freshest valid reading per pollutant; None if it has none."""
    sensors = _sensors(loc)
    readings: dict[str, StationReading] = {}
    for item in latest:
        parameter = sensors.get(item.get("sensorsId"))
        reading = _reading(loc, parameter, item, now) if parameter else None
        if reading and _fresher(reading, readings.get(reading.pollutant)):
            readings[reading.pollutant] = reading
    if not readings:
        return None
    provider = _provider(loc)
    return StationObservation(
        station_id=int(loc["id"]),
        station_name=str(loc.get("name") or f"Station {loc['id']}"),
        provider=provider,
        is_reference_monitor=bool(loc.get("isMonitor")),
        distance_km=round(distance, 1),
        readings=[readings[p] for p in POLLUTANT_ORDER if p in readings],
        attribution=_attribution(loc, provider),
    )
