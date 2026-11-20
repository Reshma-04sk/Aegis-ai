"""Deterministic extraction of a user profile from a free-text note."""

from __future__ import annotations

import re

from .models import Activity, Group

_GROUP_PATTERNS: dict[Group, re.Pattern[str]] = {
    Group.ASTHMA: re.compile(r"\b(asthma\w*|inhaler|copd|bronch\w+)\b", re.IGNORECASE),
    Group.CHILD: re.compile(
        r"\b(child|children|kid|kids|toddler|baby|infant|son|daughter)\b", re.IGNORECASE
    ),
    Group.ELDERLY: re.compile(
        r"\b(elderly|senior|grandmother|grandfather|grandparents?)\b", re.IGNORECASE
    ),
    Group.PREGNANT: re.compile(r"\b(pregnan\w+|expecting)\b", re.IGNORECASE),
    Group.HEART: re.compile(
        r"\b(heart (condition|disease|patient)|cardiac|hypertension)\b", re.IGNORECASE
    ),
}

_ACTIVITY_PATTERNS: tuple[tuple[Activity, re.Pattern[str]], ...] = (
    (Activity.RUN, re.compile(r"\b(run|running|jog|jogging|marathon)\b", re.IGNORECASE)),
    (Activity.CYCLE, re.compile(r"\b(cycle|cycling|bike|biking|bicycle)\b", re.IGNORECASE)),
    (Activity.COMMUTE, re.compile(r"\b(commute|commuting|office|school run)\b", re.IGNORECASE)),
    (Activity.WALK, re.compile(r"\b(walk|walking|stroll|hike|hiking)\b", re.IGNORECASE)),
)

_NEGATIONS = {"no", "not", "never", "without", "don't", "dont", "doesn't", "doesnt"}


def _negated(text: str, start: int) -> bool:
    """True if one of the three words before ``start`` is a negation."""
    preceding = re.findall(r"[\w']+", text[:start].lower())[-3:]
    return any(word in _NEGATIONS for word in preceding)


def _matches(pattern: re.Pattern[str], text: str) -> bool:
    return any(not _negated(text, m.start()) for m in pattern.finditer(text))


def extract_from_note(note: str | None) -> tuple[set[Group], Activity | None]:
    """Return (groups, activity) implied by the note; the most intense activity wins."""
    if not note:
        return set(), None
    groups = {group for group, pattern in _GROUP_PATTERNS.items() if _matches(pattern, note)}
    for activity, pattern in _ACTIVITY_PATTERNS:  # ordered by intensity
        if _matches(pattern, note):
            return groups, activity
    return groups, None
