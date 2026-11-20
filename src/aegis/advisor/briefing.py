"""Deterministic briefing (the fallback) and validation of model-written briefings."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..models import PlanResponse

MAX_BRIEFING_CHARS = 700
_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
_LEAD = {
    "go": "Good news: the air is fine for your household's plans.",
    "caution": "The air is acceptable today with some care.",
    "limit": "It is best for your household to limit time outdoors today.",
    "avoid": "It is best for your household to stay indoors as much as possible today.",
}


def _optional_parts(plan: PlanResponse) -> list[str]:
    """Window, indoor tip, commute and staleness sentences, each only when it applies."""
    window = plan.best_window
    parts = []
    if window and not window.starts_now:
        parts.append(
            f"The cleanest two hours are around {window.start[11:16]} to {window.end[11:16]}."
        )
    if plan.indoor and plan.indoor.tips:
        parts.append(plan.indoor.tips[0])
    if plan.commute:
        parts.append(plan.commute.summary)
    if plan.provenance.stale:
        parts.append("Note: this data is more than 3 hours old.")
    return parts


def rules_briefing(plan: PlanResponse) -> str:
    """Briefing built only from the plan; used whenever Gemini is absent or fails."""
    lead = [_LEAD[plan.household_verdict.value], f"US AQI is {round(plan.aqi)} ({plan.category})."]
    return " ".join(lead + _optional_parts(plan))


def clean_briefing(text: object) -> str | None:
    """Validate model output: a short, link-free string without control characters."""
    if not isinstance(text, str):
        return None
    text = _CONTROL.sub("", text).strip()
    if not text or len(text) > MAX_BRIEFING_CHARS or "http" in text.lower() or "www." in text:
        return None
    return text
