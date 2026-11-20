"""Turn Open-Meteo air-quality and weather payloads into typed models. Missing stays missing."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from ..errors import AirDataError
from ..freshness import STALE_AFTER_MINUTES
from ..models import AirSnapshot, HourlyPoint, Provenance, Weather

POLLUTANTS = ("pm2_5", "pm10", "nitrogen_dioxide", "ozone", "sulphur_dioxide", "carbon_monoxide")
HOURS_AHEAD = 24


def _num(value: Any) -> float | None:
    """A real number, or None for anything else (booleans included)."""
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None


def _at(values: list[Any], index: int) -> float | None:
    """The number at index, or None when the series is shorter."""
    return _num(values[index]) if index < len(values) else None


def _provenance(observed: str, utc_offset_seconds: int, now: datetime) -> Provenance:
    """Observation time, retrieval time, age in minutes and the stale flag."""
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
    """Wind, boundary-layer height and the day's peak mixing hour; None if absent."""
    hourly = (data or {}).get("hourly")
    if not isinstance(hourly, dict):
        return None
    times = [str(t) for t in hourly.get("time") or []]
    wind, blh = hourly.get("wind_speed_10m") or [], hourly.get("boundary_layer_height") or []
    now_i = next((i for i, t in enumerate(times) if t[:13] == hour_prefix), None)
    if now_i is None:
        return None
    end = min(now_i + HOURS_AHEAD, len(times), len(blh))
    known = [(times[i], v) for i in range(now_i, end) if (v := _num(blh[i])) is not None]
    peak = max(known, key=lambda item: item[1], default=(None, None))
    return Weather(
        wind_speed_kmh=_at(wind, now_i),
        boundary_layer_m=_at(blh, now_i),
        peak_mixing_time=peak[0],
        peak_boundary_layer_m=peak[1],
    )


def _hourly(data: dict[str, Any]) -> list[HourlyPoint]:
    """Every forecast hour with its AQI and PM2.5, gaps left as None."""
    raw = data.get("hourly") or {}
    aqi, pm = raw.get("us_aqi") or [], raw.get("pm2_5") or []
    return [
        HourlyPoint(time=str(t), us_aqi=_at(aqi, i), pm2_5=_at(pm, i))
        for i, t in enumerate(raw.get("time") or [])
    ]


def parse_air_response(
    data: dict[str, Any],
    place: tuple[str, float, float],
    *,
    weather: dict[str, Any] | None = None,
    now: datetime | None = None,
) -> AirSnapshot:
    """Convert an Open-Meteo payload for place (label, latitude, longitude) to an AirSnapshot."""
    current = data.get("current")
    if not isinstance(current, dict) or _num(current.get("us_aqi")) is None:
        raise AirDataError("no current air quality data for this location")
    observed = str(current.get("time", ""))
    hourly = _hourly(data)
    start = next((i for i, p in enumerate(hourly) if p.time[:13] == observed[:13]), 0)
    offset = data.get("utc_offset_seconds")
    return AirSnapshot(
        location_name=place[0],
        latitude=place[1],
        longitude=place[2],
        timezone=str(data.get("timezone", "UTC")),
        aqi=float(current["us_aqi"]),
        pollutants={p: _num(current.get(p)) for p in POLLUTANTS},
        sub_indices={p: _num(current.get(f"us_aqi_{p}")) for p in POLLUTANTS},
        hourly=hourly[start : start + HOURS_AHEAD],
        provenance=_provenance(
            observed, offset if isinstance(offset, int) else 0, now or datetime.now(UTC)
        ),
        weather=parse_weather(weather, observed[:13]),
    )
