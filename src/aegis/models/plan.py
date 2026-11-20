"""The plan returned by POST /api/plan, the briefing, and the error body."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from .advice import CommuteAdvice, IndoorAdvice, MemberAdvice, ScheduledActivity, TimeWindow
from .air import HourlyPoint, Provenance, Weather
from .enums import Verdict
from .station import StationObservation, StationStatus


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
