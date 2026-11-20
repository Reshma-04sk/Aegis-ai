"""Validate raw OpenAQ timestamps and values. Anything doubtful becomes None, never a guess."""

from __future__ import annotations

import math
from datetime import datetime

FUTURE_SKEW_MINUTES = 5


def age_minutes(utc: object, now: datetime) -> int | None:
    """Minutes since a timezone-aware ISO timestamp; None if missing, naive or in the future."""
    if not isinstance(utc, str):
        return None
    try:
        when = datetime.fromisoformat(utc)
    except ValueError:
        return None
    if when.tzinfo is None:
        return None
    minutes = int((now - when).total_seconds() // 60)
    return None if minutes < -FUTURE_SKEW_MINUTES else max(0, minutes)


def measured_value(raw: object) -> float | None:
    """Negative sentinels (e.g. -999), NaN and infinity mean no data; those stay missing."""
    if isinstance(raw, bool) or not isinstance(raw, int | float):
        return None
    if not math.isfinite(raw) or raw < 0:
        return None
    return float(raw)
