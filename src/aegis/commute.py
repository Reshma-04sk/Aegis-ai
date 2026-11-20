"""Greener-commute comparison with macro and micro impact kept strictly separate.

Macro: kg CO2e from UK DESNZ 2026 conversion factors ("Business travel- land", direct).
Micro: PM2.5 inhaled per trip = concentration x inhalation rate x minutes, with rates from
the EPA Exposure Factors Handbook 2011, Table 6-2 (means, adults 31 to <41 years).
One never implies the other: lower emissions do not mean lower personal exposure.
"""

from __future__ import annotations

from .models import Commute, CommuteAdvice, Mode, ModeOption

# kg CO2e per km. "vehicle" factors are shared by occupants; "passenger" are per person.
FACTORS: dict[Mode, tuple[float, str]] = {
    Mode.CAR_PETROL: (0.16152, "vehicle"),
    Mode.CAR_DIESEL: (0.17265, "vehicle"),
    Mode.CAR_HYBRID: (0.12961, "vehicle"),
    Mode.CAR_EV: (0.02951, "vehicle"),
    Mode.MOTORBIKE: (0.11367, "vehicle"),
    Mode.TAXI: (0.14861, "passenger"),
    Mode.BUS: (0.10151, "passenger"),
    Mode.METRO: (0.02121, "passenger"),
    Mode.RAIL: (0.03092, "passenger"),
    Mode.CYCLE: (0.0, "passenger"),
    Mode.WALK: (0.0, "passenger"),
}

LABELS = {
    Mode.CAR_PETROL: "Petrol car",
    Mode.CAR_DIESEL: "Diesel car",
    Mode.CAR_HYBRID: "Hybrid car",
    Mode.CAR_EV: "Electric car",
    Mode.MOTORBIKE: "Motorbike / scooter",
    Mode.TAXI: "Taxi",
    Mode.BUS: "Bus",
    Mode.METRO: "Metro / tram",
    Mode.RAIL: "Suburban rail",
    Mode.CYCLE: "Bicycle",
    Mode.WALK: "Walking",
}

# Assumed door-to-door urban speeds (km/h).
SPEED_KMH = {
    Mode.CAR_PETROL: 25,
    Mode.CAR_DIESEL: 25,
    Mode.CAR_HYBRID: 25,
    Mode.CAR_EV: 25,
    Mode.MOTORBIKE: 30,
    Mode.TAXI: 25,
    Mode.BUS: 18,
    Mode.METRO: 33,
    Mode.RAIL: 40,
    Mode.CYCLE: 15,
    Mode.WALK: 5,
}

# EFH Table 6-2 mean inhalation rates, m³/min, adults 31 to <41.
SEDENTARY, LIGHT, MODERATE, HIGH = 4.3e-3, 1.2e-2, 2.7e-2, 4.9e-2
INHALATION = dict.fromkeys(Mode, SEDENTARY) | {
    Mode.MOTORBIKE: LIGHT,
    Mode.WALK: MODERATE,
    Mode.CYCLE: HIGH,
}
MAX_KM = {Mode.WALK: 5.0, Mode.CYCLE: 20.0}

SOURCES = [
    "UK DESNZ Greenhouse gas reporting: conversion factors 2026 (Business travel- land)",
    "US EPA Exposure Factors Handbook 2011, Chapter 6, Table 6-2",
]
ASSUMPTIONS = [
    (
        "Emission factors are UK averages; local vehicle fleets and power grids differ "
        "(an electric car charged on a coal-heavy grid emits more than shown)."
    ),
    "Metro uses the DESNZ 'Light rail and tram' factor; suburban rail uses 'National rail'.",
    "Speeds are typical urban door-to-door averages, not route-specific.",
    (
        "Inhaled PM2.5 assumes in-vehicle air equals today's modelled outdoor PM2.5; real "
        "cabin filtration and roadside levels vary."
    ),
    "Walking counted as moderate intensity, cycling as high intensity, motorbike as light.",
]


def _per_km(mode: Mode, occupants: int) -> float:
    factor, basis = FACTORS[mode]
    return factor / occupants if basis == "vehicle" else factor


def compare_commute(commute: Commute, pm25: float | None) -> CommuteAdvice:
    """Compare weekly emissions and trip exposure of each feasible mode with the current one."""
    km = commute.distance_km
    current_weekly = _per_km(commute.current_mode, commute.occupants) * km * commute.trips_per_week
    options: list[ModeOption] = []
    for mode in Mode:
        if km > MAX_KM.get(mode, 1e9) and mode is not commute.current_mode:
            continue
        minutes = km / SPEED_KMH[mode] * 60
        weekly = _per_km(mode, commute.occupants) * km * commute.trips_per_week
        dose = None if pm25 is None else round(pm25 * INHALATION[mode] * minutes, 1)
        options.append(
            ModeOption(
                mode=mode,
                label=LABELS[mode],
                minutes_per_trip=round(minutes),
                emissions_kg_co2e_per_week=round(weekly, 2),
                emissions_avoided_kg_co2e_per_week=round(current_weekly - weekly, 2),
                inhaled_pm25_ug_per_trip=dose,
                is_current=mode is commute.current_mode,
            )
        )
    options.sort(key=lambda o: o.emissions_kg_co2e_per_week)
    return CommuteAdvice(
        options=options,
        summary=_summary(options),
        assumptions=ASSUMPTIONS,
        sources=SOURCES,
    )


def _summary(options: list[ModeOption]) -> str:
    current = next(o for o in options if o.is_current)
    better = [o for o in options if o.emissions_avoided_kg_co2e_per_week > 0]
    if not better:
        return f"{current.label} is already the lowest-emission option for this trip."
    best = better[0]
    text = (
        f"Switching from {current.label.lower()} to {best.label.lower()} avoids about "
        f"{best.emissions_avoided_kg_co2e_per_week:g} kg CO2e per week."
    )
    if (
        best.inhaled_pm25_ug_per_trip is not None
        and current.inhaled_pm25_ug_per_trip is not None
        and best.inhaled_pm25_ug_per_trip > current.inhaled_pm25_ug_per_trip
    ):
        text += (
            " Note: at today's PM2.5 you would breathe in more particles per trip "
            f"({best.inhaled_pm25_ug_per_trip:g} vs {current.inhaled_pm25_ug_per_trip:g} µg), "
            "so pick quieter routes and cleaner hours, or switch on cleaner days."
        )
    return text
