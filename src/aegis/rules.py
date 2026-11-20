"""Transparent, testable decision engine. The verdict is computed here, never by an LLM.

Verdicts follow the EPA AQI category descriptions (airnow.gov/aqi/aqi-basics): sensitive
groups may be affected from "Unhealthy for Sensitive Groups", the general public from
"Unhealthy". Hard exercise moves one step stricter because people breathe several times
more air when exercising hard (EPA Exposure Factors Handbook 2011, Table 6-2).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from .aqi import POLLUTANT_LABELS, categorize, category_index, dominant_pollutant
from .models import (
    Activity,
    AirSnapshot,
    Group,
    HourlyPoint,
    Member,
    MemberAdvice,
    TimeWindow,
    Verdict,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

# Verdict per EPA category index (Good, Moderate, USG, Unhealthy, Very Unhealthy, Hazardous).
SENSITIVE_LADDER = (
    Verdict.GO,
    Verdict.CAUTION,
    Verdict.LIMIT,
    Verdict.AVOID,
    Verdict.AVOID,
    Verdict.AVOID,
)
GENERAL_LADDER = (
    Verdict.GO,
    Verdict.GO,
    Verdict.CAUTION,
    Verdict.LIMIT,
    Verdict.AVOID,
    Verdict.AVOID,
)
STRICTNESS = (Verdict.GO, Verdict.CAUTION, Verdict.LIMIT, Verdict.AVOID)
HARD_EXERCISE = {Activity.RUN, Activity.CYCLE}
LOOKAHEAD_HOURS = 24

GROUP_LABELS = {
    Group.ASTHMA: "asthma or a lung condition",
    Group.CHILD: "a child",
    Group.ELDERLY: "an older adult",
    Group.PREGNANT: "pregnancy",
    Group.HEART: "a heart condition",
}

_BASE_ACTIONS: dict[Verdict, list[str]] = {
    Verdict.GO: ["Air is fine for normal outdoor plans."],
    Verdict.CAUTION: [
        "Outdoor plans are fine; keep hard exercise shorter and take breaks.",
        "Go indoors if you notice coughing or throat irritation.",
    ],
    Verdict.LIMIT: [
        "Cut outdoor time and intensity, or move exercise indoors.",
        "If you go out, a well-fitted N95/FFP2 mask filters fine particles.",
    ],
    Verdict.AVOID: [
        "Stay indoors with windows closed and a purifier running if you have one.",
        "Skip outdoor exercise; if you must go out, wear a well-fitted N95/FFP2 mask.",
    ],
}

_GROUP_ACTIONS: dict[Group, str] = {
    Group.ASTHMA: "Keep the reliever inhaler at hand and follow the asthma action plan.",
    Group.CHILD: "Keep outdoor play short and calm; watch for coughing.",
    Group.ELDERLY: "Avoid long outdoor stays and rest often.",
    Group.PREGNANT: "Limit time near traffic and avoid outdoor exertion.",
    Group.HEART: "Avoid outdoor exertion and contact a doctor if symptoms appear.",
}

_POLLUTANT_ACTIONS: dict[str, str] = {
    "ozone": "Ozone peaks in afternoon sun; mornings and evenings are usually better.",
    "nitrogen_dioxide": "NO₂ comes mostly from traffic; choose quiet streets or parks.",
    "pm2_5": "Fine particles pass through cloth masks; an N95/FFP2 is the effective option.",
}

URGENT_HELP = (
    "For chest pain, severe breathlessness or wheezing, seek medical help or follow your "
    "local health authority's guidance."
)


def verdict_for(aqi: float, *, sensitive: bool, hard_exercise: bool = False) -> Verdict:
    """Verdict for one AQI value from the EPA ladder for the person's sensitivity."""
    ladder = SENSITIVE_LADDER if sensitive else GENERAL_LADDER
    verdict = ladder[category_index(aqi)]
    if hard_exercise:
        verdict = STRICTNESS[min(STRICTNESS.index(verdict) + 1, len(STRICTNESS) - 1)]
    return verdict


def strictest(verdicts: Sequence[Verdict]) -> Verdict:
    """Return the strictest verdict (GO when the list is empty)."""
    return max(verdicts, key=STRICTNESS.index, default=Verdict.GO)


def _parse(time: str) -> datetime:
    return datetime.fromisoformat(time)


def cleanest_window(
    hourly: Sequence[HourlyPoint],
    hours: int,
    earliest_hour: int = 0,
    latest_hour: int = 24,
    taken: Sequence[tuple[datetime, datetime]] = (),
) -> TimeWindow | None:
    """Lowest mean-AQI block of ``hours`` consecutive hours in the next 24 hours.

    Blocks must lie within [earliest_hour, latest_hour) local time, have no missing
    values and not overlap ``taken`` intervals.
    """
    points = list(hourly[:LOOKAHEAD_HOURS])
    best: tuple[float, int] | None = None
    for start in range(len(points) - hours + 1):
        block = points[start : start + hours]
        begin = _parse(block[0].time)
        end = begin + timedelta(hours=hours)
        end_hour = begin.hour + hours
        if begin.hour < earliest_hour or end_hour > latest_hour:
            continue
        if any(begin < t_end and t_start < end for t_start, t_end in taken):
            continue
        values = [p.us_aqi for p in block]
        if any(v is None for v in values):
            continue
        mean = sum(v for v in values if v is not None) / hours
        if best is None or mean < best[0]:
            best = (mean, start)
    if best is None:
        return None
    mean, start = best
    begin = _parse(points[start].time)
    return TimeWindow(
        start=begin.strftime("%Y-%m-%dT%H:%M"),
        end=(begin + timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M"),
        mean_aqi=round(mean, 1),
        starts_now=start == 0,
    )


def advise_member(snapshot: AirSnapshot, member: Member, activity: Activity) -> MemberAdvice:
    """Verdict and reasons for one member at the current AQI."""
    groups = sorted(set(member.groups))
    sensitive = bool(groups)
    hard = activity in HARD_EXERCISE
    verdict = verdict_for(snapshot.aqi, sensitive=sensitive, hard_exercise=hard)
    dominant = dominant_pollutant(snapshot.sub_indices)

    reasons = [f"US AQI is {round(snapshot.aqi)} ({categorize(snapshot.aqi)})."]
    if dominant:
        reasons.append(f"{POLLUTANT_LABELS.get(dominant, dominant)} is the main pollutant.")
    if sensitive:
        names = ", ".join(GROUP_LABELS[g] for g in groups)
        reasons.append(f"Sensitive-group guidance applies ({names}).")
    if hard:
        reasons.append(f"{activity.value.capitalize()} means breathing much more air per minute.")

    actions = list(_BASE_ACTIONS[verdict])
    if verdict is not Verdict.GO:
        actions += [_GROUP_ACTIONS[g] for g in groups]
        if dominant in _POLLUTANT_ACTIONS:
            actions.append(_POLLUTANT_ACTIONS[dominant])
    if verdict is Verdict.AVOID or (sensitive and verdict is Verdict.LIMIT):
        actions.append(URGENT_HELP)
    return MemberAdvice(
        name=member.name, groups=groups, verdict=verdict, reasons=reasons, actions=actions
    )
