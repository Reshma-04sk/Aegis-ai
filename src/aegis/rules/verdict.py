"""EPA-based verdicts. The verdict is computed here, never by an LLM.

Verdicts follow the EPA AQI category descriptions (airnow.gov/aqi/aqi-basics): sensitive
groups may be affected from "Unhealthy for Sensitive Groups", the general public from
"Unhealthy". Hard exercise moves one step stricter because people breathe several times
more air when exercising hard (EPA Exposure Factors Handbook 2011, Table 6-2).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..aqi import category_index
from ..models import Activity, Verdict

if TYPE_CHECKING:
    from collections.abc import Sequence

# Verdict per EPA category index (Good, Moderate, USG, Unhealthy, Very Unhealthy, Hazardous).
SENSITIVE_LADDER = (Verdict.GO, Verdict.CAUTION, Verdict.LIMIT, *(Verdict.AVOID,) * 3)
GENERAL_LADDER = (Verdict.GO, Verdict.GO, Verdict.CAUTION, Verdict.LIMIT, *(Verdict.AVOID,) * 2)
STRICTNESS = (Verdict.GO, Verdict.CAUTION, Verdict.LIMIT, Verdict.AVOID)
HARD_EXERCISE = frozenset({Activity.RUN, Activity.CYCLE})


def verdict_for(aqi: float, *, sensitive: bool, hard_exercise: bool = False) -> Verdict:
    """Verdict for one AQI value from the EPA ladder for the person's sensitivity."""
    ladder = SENSITIVE_LADDER if sensitive else GENERAL_LADDER
    verdict = ladder[category_index(aqi)]
    if hard_exercise:
        verdict = STRICTNESS[min(STRICTNESS.index(verdict) + 1, len(STRICTNESS) - 1)]
    return verdict


def strictest(verdicts: Sequence[Verdict]) -> Verdict:
    """Return the strictest verdict (GO when the list is empty)."""
    return max(verdicts, key=STRICTNESS.index, default=Verdict.GO)
