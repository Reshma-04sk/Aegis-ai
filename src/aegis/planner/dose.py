"""Personal PM2.5 dose for a planned activity, and the sentence that explains it.

Impact is shown as exposure: PM2.5 breathed in during the chosen slot versus starting now.
Missing hourly PM2.5 means no figure is shown; nothing is filled in.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

from ..exposure import HIGH, LIGHT, MODERATE, SEDENTARY, inhaled_ug
from ..models import Activity

if TYPE_CHECKING:
    from ..models import HourlyPoint, PlannedActivity

# EPA Exposure Factors Handbook 2011, Table 6-2 (m³/min), by activity intensity.
INHALATION = {
    Activity.REST: SEDENTARY,
    Activity.COMMUTE: LIGHT,
    Activity.WALK: MODERATE,
    Activity.CYCLE: HIGH,
    Activity.RUN: HIGH,
}


def inhaled_pm25(hourly: list[HourlyPoint], start: int, item: PlannedActivity) -> float | None:
    """Micrograms of PM2.5 breathed in when the activity starts at ``hourly[start]``."""
    hours = math.ceil(item.duration_hours)
    values = [p.pm2_5 for p in hourly[start : start + hours]]
    if len(values) < hours or None in values:
        return None
    mean = sum(v for v in values if v is not None) / len(values)
    return inhaled_ug(mean, INHALATION[item.activity], item.duration_hours * 60)


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
