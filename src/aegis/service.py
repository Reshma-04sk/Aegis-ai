"""Orchestrates the deterministic engines into one household plan."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .aqi import categorize, dominant_pollutant
from .commute import compare_commute
from .indoor import advise_indoor
from .models import Activity, AirSnapshot, Member, PlannedActivity, PlanRequest, PlanResponse
from .planner import plan_day
from .profiles import extract_from_note
from .rules import advise_member, cleanest_window, strictest

if TYPE_CHECKING:
    from .stations import StationLookup

DISCLAIMER = (
    "General guidance from modelled public air-quality data, not medical advice. Follow your "
    "doctor's plan and your local health authority's alerts."
)


def resolve_profile(body: PlanRequest) -> tuple[list[Member], list[PlannedActivity], Activity]:
    """Merge note-derived hints into the first member; explicit form fields always win."""
    note_groups, note_activity = extract_from_note(body.note)
    members = list(body.members)
    if note_groups:
        first = members[0]
        merged = sorted(set(first.groups) | note_groups)
        members[0] = first.model_copy(update={"groups": merged})
    activities = list(body.activities)
    main_activity = activities[0].activity if activities else (note_activity or Activity.WALK)
    if not activities and note_activity:
        activities = [
            PlannedActivity(
                label=note_activity.value.capitalize(), activity=note_activity, duration_hours=1
            )
        ]
    return members, activities, main_activity


def build_plan(
    snapshot: AirSnapshot, body: PlanRequest, station: StationLookup = (None, "not_configured")
) -> PlanResponse:
    """Assemble the full plan from a snapshot, the request and the nearest station."""
    members, activities, main_activity = resolve_profile(body)
    advice = [advise_member(snapshot, m, main_activity) for m in members]
    household = strictest([a.verdict for a in advice])
    pm25 = snapshot.pollutants.get("pm2_5")
    return PlanResponse(
        location=snapshot.location_name,
        aqi=snapshot.aqi,
        category=categorize(snapshot.aqi),
        dominant_pollutant=dominant_pollutant(snapshot.sub_indices),
        pollutants=snapshot.pollutants,
        provenance=snapshot.provenance,
        weather=snapshot.weather,
        household_verdict=household,
        members=advice,
        best_window=cleanest_window(snapshot.hourly, 2),
        schedule=plan_day(snapshot, activities, members),
        indoor=advise_indoor(snapshot, body.home, household) if body.home else None,
        commute=compare_commute(body.commute, pm25) if body.commute else None,
        hourly=snapshot.hourly,
        station=station[0],
        station_status=station[1],
        explanation="",
        explanation_source="rules",
        disclaimer=DISCLAIMER,
    )
