"""Low-exposure daily routine: place each planned activity in its cleanest forecast hours.

The impact of each choice is shown as personal exposure: PM2.5 breathed in during the chosen
slot versus starting now, from modelled PM2.5 x EPA inhalation rate x minutes. Missing hourly
PM2.5 means no figure is shown; nothing is filled in.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta

from .commute import HIGH, LIGHT, MODERATE, SEDENTARY
from .models import (
    Activity,
    AirSnapshot,
    HourlyPoint,
    Member,
    PlannedActivity,
    ScheduledActivity,
    Verdict,
)
from .rules import HARD_EXERCISE, cleanest_window, verdict_for

# EPA Exposure Factors Handbook 2011, Table 6-2 (m³/min), by activity intensity.
INHALATION = {
    Activity.REST: SEDENTARY,
    Activity.COMMUTE: LIGHT,
    Activity.WALK: MODERATE,
    Activity.CYCLE: HIGH,
    Activity.RUN: HIGH,
}

_ADVICE = {
    Verdict.GO: "Good slot for this activity.",
    Verdict.CAUTION: "Acceptable slot; keep the effort moderate.",
    Verdict.LIMIT: "Even the cleanest slot is polluted; shorten it or do it indoors.",
    Verdict.AVOID: "Air stays poor all day; do an indoor alternative instead.",
}


def inhaled_pm25(hourly: list[HourlyPoint], start: int, item: PlannedActivity) -> float | None:
    """Micrograms of PM2.5 breathed in when the activity starts at ``hourly[start]``."""
    points = hourly[start : start + math.ceil(item.duration_hours)]
    values = [p.pm2_5 for p in points]
    if not values or len(values) < math.ceil(item.duration_hours) or None in values:
        return None
    mean = sum(v for v in values if v is not None) / len(values)
    return round(mean * INHALATION[item.activity] * item.duration_hours * 60, 1)


def exposure_note(chosen: float | None, now: float | None, *, starts_now: bool) -> str | None:
    """Explain the dose for the chosen slot and how much starting now would add."""
    if chosen is None:
        return None
    if starts_now or now is None or now <= chosen:
        return f"You would breathe in about {chosen:g} µg of PM2.5 in this slot."
    saving = round(100 * (now - chosen) / now)
    return (
        f"About {chosen:g} µg of PM2.5 breathed in, versus {now:g} µg if you went now: "
        f"{saving}% less exposure from choosing this time."
    )


def plan_day(
    snapshot: AirSnapshot, activities: list[PlannedActivity], members: list[Member]
) -> list[ScheduledActivity]:
    """Longest activities are placed first so they get the cleanest long blocks."""
    sensitive = any(m.groups for m in members)
    taken: list[tuple[datetime, datetime]] = []
    placed: dict[int, ScheduledActivity] = {}
    order = sorted(range(len(activities)), key=lambda i: -activities[i].duration_hours)
    for i in order:
        item = activities[i]
        hours = math.ceil(item.duration_hours)
        window = cleanest_window(
            snapshot.hourly, hours, item.earliest_hour, item.latest_hour, taken
        )
        if window is None:
            placed[i] = ScheduledActivity(
                label=item.label,
                activity=item.activity,
                window=None,
                verdict=None,
                advice="No forecast slot fits this time range; try widening it.",
            )
            continue
        start = datetime.fromisoformat(window.start)
        taken.append((start, start + timedelta(hours=hours)))
        verdict = verdict_for(
            window.mean_aqi, sensitive=sensitive, hard_exercise=item.activity in HARD_EXERCISE
        )
        index = next(n for n, p in enumerate(snapshot.hourly) if p.time == window.start)
        chosen = inhaled_pm25(snapshot.hourly, index, item)
        now = inhaled_pm25(snapshot.hourly, 0, item)
        placed[i] = ScheduledActivity(
            label=item.label,
            activity=item.activity,
            window=window,
            verdict=verdict,
            advice=_ADVICE[verdict],
            inhaled_pm25_ug=chosen,
            inhaled_pm25_now_ug=now,
            exposure_note=exposure_note(chosen, now, starts_now=window.starts_now),
        )
    return [placed[i] for i in range(len(activities))]
