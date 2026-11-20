"""Find the cleanest block of consecutive hours in the next day's forecast."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from ..models import TimeWindow

if TYPE_CHECKING:
    from collections.abc import Sequence

    from ..models import HourlyPoint

LOOKAHEAD_HOURS = 24

type Interval = tuple[datetime, datetime]  # [start, end) already booked


def _block_mean(block: Sequence[HourlyPoint]) -> float | None:
    """Mean AQI of the block, or None when any hour is missing (missing stays missing)."""
    values = [p.us_aqi for p in block]
    if any(v is None for v in values):
        return None
    return sum(v for v in values if v is not None) / len(values)


def _allowed(
    begin: datetime, hours: int, bounds: tuple[int, int], taken: Sequence[Interval]
) -> bool:
    """Inside [earliest, latest) local hours and clear of every taken interval."""
    end = begin + timedelta(hours=hours)
    if begin.hour < bounds[0] or begin.hour + hours > bounds[1]:
        return False
    return not any(begin < t_end and t_start < end for t_start, t_end in taken)


def cleanest_window(
    hourly: Sequence[HourlyPoint],
    hours: int,
    earliest_hour: int = 0,
    latest_hour: int = 24,
    taken: Sequence[Interval] = (),
) -> TimeWindow | None:
    """Lowest mean-AQI block of ``hours`` consecutive, fully known hours in the next 24."""
    points = list(hourly[:LOOKAHEAD_HOURS])
    scored = [
        (mean, start)
        for start in range(len(points) - hours + 1)
        if _allowed(
            datetime.fromisoformat(points[start].time), hours, (earliest_hour, latest_hour), taken
        )
        and (mean := _block_mean(points[start : start + hours])) is not None
    ]
    if not scored:
        return None
    mean, start = min(scored, key=lambda item: item[0])
    begin = datetime.fromisoformat(points[start].time)
    return TimeWindow(
        start=begin.strftime("%Y-%m-%dT%H:%M"),
        end=(begin + timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M"),
        mean_aqi=round(mean, 1),
        starts_now=start == 0,
    )
