"""Compare each feasible commute mode with the current one, macro and micro kept apart.

One never implies the other: lower emissions do not mean lower personal exposure.
"""

from __future__ import annotations

from ..exposure import inhaled_ug
from ..models import Commute, CommuteAdvice, Mode, ModeOption
from .factors import ASSUMPTIONS, INHALATION, LABELS, MAX_KM, SOURCES, SPEED_KMH, per_km


def _feasible(mode: Mode, commute: Commute) -> bool:
    """Walking and cycling only within their distance limits; the current mode always."""
    return mode is commute.current_mode or commute.distance_km <= MAX_KM.get(mode, float("inf"))


def _option(mode: Mode, commute: Commute, pm25: float | None) -> ModeOption:
    """Weekly emissions, emissions avoided versus now, and the per-trip dose for one mode."""
    km = commute.distance_km
    minutes = km / SPEED_KMH[mode] * 60
    weekly = per_km(mode, commute.occupants) * km * commute.trips_per_week
    dose = None if pm25 is None else inhaled_ug(pm25, INHALATION[mode], minutes)
    current = per_km(commute.current_mode, commute.occupants) * km * commute.trips_per_week
    return ModeOption(
        mode=mode,
        label=LABELS[mode],
        minutes_per_trip=round(minutes),
        emissions_kg_co2e_per_week=round(weekly, 2),
        emissions_avoided_kg_co2e_per_week=round(current - weekly, 2),
        inhaled_pm25_ug_per_trip=dose,
        is_current=mode is commute.current_mode,
    )


def _exposure_warning(best: ModeOption, current: ModeOption) -> str:
    """A note when the lower-emission mode means breathing in more particles per trip."""
    new, old = best.inhaled_pm25_ug_per_trip, current.inhaled_pm25_ug_per_trip
    if new is None or old is None or new <= old:
        return ""
    return (
        " Note: at today's PM2.5 you would breathe in more particles per trip "
        f"({new:g} vs {old:g} µg), so pick quieter routes and cleaner hours, "
        "or switch on cleaner days."
    )


def summarise(options: list[ModeOption]) -> str:
    """One sentence on the best switch, plus the exposure trade-off when there is one."""
    current = next(o for o in options if o.is_current)
    better = [o for o in options if o.emissions_avoided_kg_co2e_per_week > 0]
    if not better:
        return f"{current.label} is already the lowest-emission option for this trip."
    best = better[0]
    return (
        f"Switching from {current.label.lower()} to {best.label.lower()} avoids about "
        f"{best.emissions_avoided_kg_co2e_per_week:g} kg CO2e per week."
    ) + _exposure_warning(best, current)


def compare_commute(commute: Commute, pm25: float | None) -> CommuteAdvice:
    """Every feasible mode, lowest emissions first, with a plain-language summary."""
    options = sorted(
        (_option(mode, commute, pm25) for mode in Mode if _feasible(mode, commute)),
        key=lambda o: o.emissions_kg_co2e_per_week,
    )
    return CommuteAdvice(
        options=options, summary=summarise(options), assumptions=ASSUMPTIONS, sources=SOURCES
    )
