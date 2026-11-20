"""Commute data: emission factors (macro), speeds, distance limits, sources and assumptions.

Macro: kg CO2e from UK DESNZ 2026 conversion factors ("Business travel- land", direct).
"""

from __future__ import annotations

from ..exposure import HIGH, LIGHT, MODERATE, SEDENTARY
from ..models import Mode

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
SPEED_KMH = dict.fromkeys(Mode, 25) | {
    Mode.MOTORBIKE: 30,
    Mode.BUS: 18,
    Mode.METRO: 33,
    Mode.RAIL: 40,
    Mode.CYCLE: 15,
    Mode.WALK: 5,
}
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


def per_km(mode: Mode, occupants: int) -> float:
    """Kg CO2e per person-km; vehicle factors are split between occupants."""
    factor, basis = FACTORS[mode]
    return factor / occupants if basis == "vehicle" else factor
