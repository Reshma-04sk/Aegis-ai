"""Pydantic v2 models: the API contract, mirrored for the browser in types/api.d.ts.

Split by domain; everything is re-exported here, so callers import from ``aegis.models``.
"""

from .advice import (
    CommuteAdvice,
    IndoorAdvice,
    MemberAdvice,
    ModeOption,
    ScheduledActivity,
    TimeWindow,
)
from .air import AirSnapshot, HourlyPoint, Provenance, Weather
from .enums import Activity, Group, Mode, Verdict
from .plan import Briefing, ErrorDetail, PlanResponse
from .request import Commute, Home, Label, Member, Place, PlannedActivity, PlanRequest
from .station import StationObservation, StationReading, StationStatus

__all__ = [
    "Activity",
    "AirSnapshot",
    "Briefing",
    "Commute",
    "CommuteAdvice",
    "ErrorDetail",
    "Group",
    "Home",
    "HourlyPoint",
    "IndoorAdvice",
    "Label",
    "Member",
    "MemberAdvice",
    "Mode",
    "ModeOption",
    "Place",
    "PlanRequest",
    "PlanResponse",
    "PlannedActivity",
    "Provenance",
    "ScheduledActivity",
    "StationObservation",
    "StationReading",
    "StationStatus",
    "TimeWindow",
    "Verdict",
    "Weather",
]
