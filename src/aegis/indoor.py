"""Indoor air estimate: purifier sizing, clean-air changes per hour and airing window.

Sizing follows the EPA "Guide to Air Cleaners in the Home" chart (minimum CADR in cfm is
0.65 x room area in ft², for an 8 ft ceiling). Decay uses an idealised well-mixed room:
C(t) = C0 * exp(-ACH * t), so a 90% cut takes ln(10) / ACH hours.
"""

from __future__ import annotations

import math

from .models import AirSnapshot, Home, IndoorAdvice, TimeWindow, Verdict
from .rules import cleanest_window

FT2_PER_M2 = 10.7639
M3H_PER_CFM = 1.69901
EPA_CFM_PER_FT2 = 0.65
EPA_CEILING_M = 2.4384  # 8 ft

ASSUMPTIONS = [
    "Well-mixed room with doors and windows closed.",
    "Purifier CADR is the manufacturer's smoke/particle rating.",
    "Real results vary with filter condition, placement, leaks and indoor sources.",
    "No indoor sensor is used: these are estimates, not measurements.",
]

_TIPS_ALWAYS = [
    "Avoid burning incense, candles, mosquito coils, wood or coal indoors.",
    "Use the kitchen exhaust (or open a window briefly) while frying or grilling.",
    "Damp-dust and wet-mop instead of sweeping, which lifts settled particles.",
]
_TIPS_POLLUTED = [
    "Keep windows and doors shut while outdoor air is poor; seal obvious gaps.",
    "Run the purifier on high in the room where people sleep, door closed.",
    "No purifier? A box fan with a MERV 13 filter taped to its intake is a low-cost option.",
]


def recommended_cadr_m3h(home: Home) -> float:
    """Clean air delivery rate for the room: EPA 2/3 rule scaled by ceiling height."""
    cfm = EPA_CFM_PER_FT2 * home.floor_area_m2 * FT2_PER_M2
    return cfm * M3H_PER_CFM * (home.ceiling_height_m / EPA_CEILING_M)


def advise_indoor(snapshot: AirSnapshot, home: Home, outdoor_verdict: Verdict) -> IndoorAdvice:
    """Indoor steps: windows, purifier adequacy and air changes per hour."""
    volume = home.floor_area_m2 * home.ceiling_height_m
    recommended = recommended_cadr_m3h(home)
    cadr = home.purifier_cadr_m3h
    ach = minutes = adequate = None
    if cadr:
        ach = round(cadr / volume, 1)
        minutes = round(math.log(10) / (cadr / volume) * 60)
        adequate = cadr >= recommended

    window: TimeWindow | None = cleanest_window(snapshot.hourly, 1, 6, 23)
    polluted = outdoor_verdict in (Verdict.LIMIT, Verdict.AVOID)
    tips = (_TIPS_POLLUTED if polluted else []) + _TIPS_ALWAYS
    if window and not window.starts_now and window.mean_aqi < snapshot.aqi:
        tips.insert(0, f"Air the home briefly around {window.start[11:16]}, the cleanest hour.")
    elif polluted:
        tips.insert(0, "Keep airing short today: outdoor air is not forecast to improve much.")
    if cadr is not None and adequate is False:
        tips.append(
            f"This purifier is undersized for the room; aim for about {round(recommended)} m³/h."
        )

    return IndoorAdvice(
        room_volume_m3=round(volume, 1),
        recommended_cadr_m3h=round(recommended),
        purifier_cadr_m3h=cadr,
        clean_air_changes_per_hour=ach,
        minutes_to_cut_particles_90pct=minutes,
        purifier_adequate=adequate,
        airing_window=window,
        tips=tips,
        assumptions=ASSUMPTIONS,
    )
