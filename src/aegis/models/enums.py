"""Enumerations shared by requests, rules and responses."""

from __future__ import annotations

from enum import StrEnum


class Group(StrEnum):
    """Health groups that are more sensitive to air pollution."""

    ASTHMA = "asthma"
    CHILD = "child"
    ELDERLY = "elderly"
    PREGNANT = "pregnant"
    HEART = "heart_condition"


class Activity(StrEnum):
    """Outdoor activity, ordered from rest to hard exercise."""

    REST = "rest"
    WALK = "walk"
    COMMUTE = "commute"
    CYCLE = "cycle"
    RUN = "run"


class Verdict(StrEnum):
    """Advice level: go, caution, limit or avoid."""

    GO = "go"
    CAUTION = "caution"
    LIMIT = "limit"
    AVOID = "avoid"


class Mode(StrEnum):
    """Commute mode with a published emission factor."""

    CAR_PETROL = "car_petrol"
    CAR_DIESEL = "car_diesel"
    CAR_HYBRID = "car_hybrid"
    CAR_EV = "car_ev"
    MOTORBIKE = "motorbike"
    TAXI = "taxi"
    BUS = "bus"
    METRO = "metro"
    RAIL = "rail"
    CYCLE = "cycle"
    WALK = "walk"
