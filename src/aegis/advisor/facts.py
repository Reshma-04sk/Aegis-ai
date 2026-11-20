"""The minimal, name-free facts about a plan that the model is allowed to see."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..models import PlanResponse, StationObservation


def _schedule(plan: PlanResponse) -> list[dict[str, Any]]:
    """Each planned activity with its start time, verdict and exposure note."""
    return [
        {
            "activity": s.activity.value,
            "start": s.window.start[11:16] if s.window else None,
            "verdict": s.verdict.value if s.verdict else None,
            "exposure_impact": s.exposure_note,
        }
        for s in plan.schedule
    ]


def _station(station: StationObservation | None) -> dict[str, Any] | None:
    """Fresh measured readings only; stale or missing values are left out."""
    if station is None:
        return None
    readings = {
        r.pollutant: f"{r.value:g} {r.unit}, {r.data_age_minutes} min old"
        for r in station.readings
        if r.value is not None and not r.stale
    }
    return {"distance_km": station.distance_km, "readings": readings}


def plan_facts(plan: PlanResponse) -> dict[str, Any]:
    """Everything the briefing may mention, and nothing that identifies a person."""
    return {
        "us_aqi": round(plan.aqi),
        "category": plan.category,
        "main_pollutant": plan.dominant_pollutant,
        "data_age_minutes": plan.provenance.data_age_minutes,
        "stale": plan.provenance.stale,
        "data_kind": plan.provenance.kind,
        "household_verdict": plan.household_verdict.value,
        "members": [
            {"sensitive_groups": [g.value for g in m.groups], "verdict": m.verdict.value}
            for m in plan.members
        ],
        "best_2h_window": plan.best_window.model_dump() if plan.best_window else None,
        "schedule": _schedule(plan),
        "indoor_top_tip": plan.indoor.tips[0] if plan.indoor and plan.indoor.tips else None,
        "commute_summary": plan.commute.summary if plan.commute else None,
        "nearest_station_measured": _station(plan.station),
    }
