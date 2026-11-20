"""Low-exposure daily routine: place each planned activity in its cleanest forecast hours."""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from ..models import ScheduledActivity, Verdict
from ..rules import HARD_EXERCISE, cleanest_window, verdict_for
from .dose import exposure_note, inhaled_pm25

if TYPE_CHECKING:
    from ..models import AirSnapshot, Member, PlannedActivity, TimeWindow
    from ..rules.window import Interval

ADVICE = {
    Verdict.GO: "Good slot for this activity.",
    Verdict.CAUTION: "Acceptable slot; keep the effort moderate.",
    Verdict.LIMIT: "Even the cleanest slot is polluted; shorten it or do it indoors.",
    Verdict.AVOID: "Air stays poor all day; do an indoor alternative instead.",
}
NO_SLOT = "No forecast slot fits this time range; try widening it."


def _scheduled(
    snapshot: AirSnapshot, item: PlannedActivity, window: TimeWindow, *, sensitive: bool
) -> ScheduledActivity:
    """The activity in its window, with the verdict there and the dose versus going now."""
    hard = item.activity in HARD_EXERCISE
    verdict = verdict_for(window.mean_aqi, sensitive=sensitive, hard_exercise=hard)
    index = next(n for n, p in enumerate(snapshot.hourly) if p.time == window.start)
    chosen = inhaled_pm25(snapshot.hourly, index, item)
    now = inhaled_pm25(snapshot.hourly, 0, item)
    return ScheduledActivity(
        label=item.label,
        activity=item.activity,
        window=window,
        verdict=verdict,
        advice=ADVICE[verdict],
        inhaled_pm25_ug=chosen,
        inhaled_pm25_now_ug=now,
        exposure_note=exposure_note(chosen, now, starts_now=window.starts_now),
    )


def _place(
    snapshot: AirSnapshot, item: PlannedActivity, taken: list[Interval], *, sensitive: bool
) -> ScheduledActivity:
    """Cleanest free window inside the activity's hours; it is then marked as taken."""
    hours = math.ceil(item.duration_hours)
    window = cleanest_window(snapshot.hourly, hours, item.earliest_hour, item.latest_hour, taken)
    if window is None:
        return ScheduledActivity(
            label=item.label, activity=item.activity, window=None, verdict=None, advice=NO_SLOT
        )
    start = datetime.fromisoformat(window.start)
    taken.append((start, start + timedelta(hours=hours)))
    return _scheduled(snapshot, item, window, sensitive=sensitive)


def plan_day(
    snapshot: AirSnapshot, activities: list[PlannedActivity], members: list[Member]
) -> list[ScheduledActivity]:
    """Longest activities are placed first so they get the cleanest long blocks."""
    sensitive = any(m.groups for m in members)
    taken: list[Interval] = []
    order = sorted(range(len(activities)), key=lambda i: -activities[i].duration_hours)
    placed = {i: _place(snapshot, activities[i], taken, sensitive=sensitive) for i in order}
    return [placed[i] for i in range(len(activities))]
