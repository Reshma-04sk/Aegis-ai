"""The plan returned by the API: verdicts, schedule, indoor and commute advice, briefing."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from .air import HourlyPoint, Provenance, Weather
from .enums import Activity, Group, Mode, Verdict
from .station import StationObservation, StationStatus


class TimeWindow(BaseModel):
    """A run of consecutive forecast hours and their mean AQI."""

    start: str
    end: str
    mean_aqi: float
    starts_now: bool


class MemberAdvice(BaseModel):
    """Verdict and reasons for one household member."""

    name: str
    groups: list[Group]
    verdict: Verdict
    reasons: list[str]
    actions: list[str]


class ScheduledActivity(BaseModel):
    """A plan moved into its cleanest window, with the inhaled PM2.5 dose."""

    label: str
    activity: Activity
    window: TimeWindow | None
    verdict: Verdict | None
    advice: str
    # Personal exposure (micro), never emissions: PM2.5 breathed in during the activity.
    inhaled_pm25_ug: float | None = None
    inhaled_pm25_now_ug: float | None = None
    exposure_note: str | None = None


class IndoorAdvice(BaseModel):
    """Indoor air steps and purifier adequacy."""

    room_volume_m3: float
    recommended_cadr_m3h: float
    purifier_cadr_m3h: float | None
    clean_air_changes_per_hour: float | None
    minutes_to_cut_particles_90pct: int | None
    purifier_adequate: bool | None
    airing_window: TimeWindow | None
    tips: list[str]
    assumptions: list[str]


class ModeOption(BaseModel):
    """Weekly emissions and trip exposure for one commute mode."""

    mode: Mode
    label: str
    minutes_per_trip: int
    # Macro impact: greenhouse-gas emissions, never a health claim.
    emissions_kg_co2e_per_week: float
    emissions_avoided_kg_co2e_per_week: float
    # Micro impact: personal PM2.5 inhaled at today's modelled concentration.
    inhaled_pm25_ug_per_trip: float | None
    is_current: bool


class CommuteAdvice(BaseModel):
    """All feasible commute modes compared with the current one."""

    options: list[ModeOption]
    summary: str
    assumptions: list[str]
    sources: list[str]


class PlanResponse(BaseModel):
    """The full deterministic plan returned by POST /api/plan."""

    location: str
    aqi: float
    category: str
    dominant_pollutant: str | None
    pollutants: dict[str, float | None]
    provenance: Provenance
    weather: Weather | None
    household_verdict: Verdict
    members: list[MemberAdvice]
    best_window: TimeWindow | None
    schedule: list[ScheduledActivity]
    indoor: IndoorAdvice | None
    commute: CommuteAdvice | None
    hourly: list[HourlyPoint]
    station: StationObservation | None = None
    station_status: StationStatus = "not_configured"
    explanation: str
    explanation_source: Literal["gemini", "rules"]
    briefing_id: str | None = None
    disclaimer: str


class ErrorDetail(BaseModel):
    """Error body for 404, 429 and 502 responses."""

    detail: str


class Briefing(BaseModel):
    """The AI (or rules) briefing returned by POST /api/briefing/{id}."""

    explanation: str
    explanation_source: Literal["gemini", "rules"]
