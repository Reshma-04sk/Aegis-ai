"""Station observations (via OpenAQ): measured values, kept apart from the model estimate."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class StationReading(BaseModel):
    """One measured value from a monitoring station, exactly as the provider reported it."""

    kind: Literal["station_observation"] = "station_observation"
    station_id: int
    provider: str
    pollutant: str
    label: str
    value: float | None
    unit: str
    observed_at: str | None
    retrieved_at: str
    data_age_minutes: int | None
    stale: bool


class StationObservation(BaseModel):
    """Nearest station with a recent reading. Shown beside, never merged with, the forecast."""

    station_id: int
    station_name: str
    provider: str
    is_reference_monitor: bool
    distance_km: float
    readings: list[StationReading]
    attribution: str
    source: str = "OpenAQ"
    source_url: str = "https://openaq.org"


StationStatus = Literal["ok", "not_configured", "none_nearby", "unavailable"]
