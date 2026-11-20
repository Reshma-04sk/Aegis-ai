"""Modelled air quality (CAMS via Open-Meteo) and its provenance."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HourlyPoint(BaseModel):
    """One forecast hour: US AQI and PM2.5."""

    time: str
    us_aqi: float | None
    pm2_5: float | None = None


class Weather(BaseModel):
    """Weather that drives pollution: wind and boundary-layer mixing."""

    wind_speed_kmh: float | None
    boundary_layer_m: float | None
    peak_mixing_time: str | None
    peak_boundary_layer_m: float | None


class Provenance(BaseModel):
    """Where a value came from, when it was fetched and whether it is stale."""

    source: str = "Open-Meteo Air Quality API"
    model: str = "CAMS (Copernicus Atmosphere Monitoring Service) forecast"
    kind: Literal["model_estimate"] = "model_estimate"
    observed_at: str
    retrieved_at: str
    data_age_minutes: int
    stale: bool
    attribution: str = "Air quality data by Open-Meteo.com (CC BY 4.0), based on Copernicus CAMS"
    licence_url: str = "https://open-meteo.com/en/licence"


class AirSnapshot(BaseModel):
    """Modelled air quality for one place, with its provenance."""

    location_name: str
    latitude: float
    longitude: float
    timezone: str
    aqi: float
    pollutants: dict[str, float | None] = Field(default_factory=dict)
    sub_indices: dict[str, float | None] = Field(default_factory=dict)
    hourly: list[HourlyPoint] = Field(default_factory=list)
    provenance: Provenance
    weather: Weather | None = None
