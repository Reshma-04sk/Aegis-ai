"""Front-end constants: the AQI bands, labels, limits and form choices the UI is built from.

The React front end imports them from ``web/src/generated/config.json``, which
``uv run aegis-config`` writes from this module. ``tests/test_frontend.py`` fails when that file
drifts, so Python stays the single source of truth for both the API and the UI.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from .aqi import CATEGORIES, HAZARDOUS, POLLUTANT_LABELS
from .commute import LABELS as MODE_LABELS
from .freshness import STALE_AFTER_MINUTES
from .models import Activity, Group
from .stations import RECENT_MINUTES, SEARCH_RADIUS_M

# Short labels for the planner form (the rules module words groups as full phrases).
GROUP_CHOICES: dict[Group, str] = {
    Group.ASTHMA: "Asthma / lung",
    Group.CHILD: "Child",
    Group.ELDERLY: "Older adult",
    Group.PREGNANT: "Pregnant",
    Group.HEART: "Heart condition",
}
ACTIVITY_CHOICES: dict[Activity, str] = {
    Activity.WALK: "Walking",
    Activity.RUN: "Running / sport",
    Activity.CYCLE: "Cycling",
    Activity.COMMUTE: "Commute",
    Activity.REST: "Sitting outdoors",
}
DURATION_CHOICES = ("0.5", "1", "2", "3")
CATEGORY_KEYS = ("good", "moderate", "usg", "unhealthy", "very-unhealthy", "hazardous")
CATEGORY_ICONS = ("●", "◆", "▲", "■", "✖", "☠")


def _choices(labels: dict[Any, str]) -> list[dict[str, str]]:
    """Enum-keyed labels as an ordered list of {value, label} for a select or checkbox group."""
    return [{"value": str(value), "label": label} for value, label in labels.items()]


def front_end_config() -> dict[str, Any]:
    """Everything the browser needs from Python, as one JSON-ready object."""
    bands = [*CATEGORIES, (HAZARDOUS, None)]
    return {
        "categories": [
            {"name": name, "max": upper, "key": key, "icon": icon}
            for (name, upper), key, icon in zip(bands, CATEGORY_KEYS, CATEGORY_ICONS, strict=True)
        ],
        "pollutantLabels": POLLUTANT_LABELS,
        "staleAfterHours": STALE_AFTER_MINUTES // 60,
        "stationRadiusKm": SEARCH_RADIUS_M // 1000,
        "stationRecentHours": RECENT_MINUTES // 60,
        "groups": _choices(GROUP_CHOICES),
        "activities": _choices(ACTIVITY_CHOICES),
        "durations": list(DURATION_CHOICES),
        "modes": _choices(MODE_LABELS),
    }


def render_config() -> str:
    """The config file's exact text: two-space indented JSON, UTF-8, trailing newline."""
    return json.dumps(front_end_config(), indent=2, ensure_ascii=False) + "\n"


def main() -> None:
    """Console entry point (``aegis-config``): print the config for the front-end build."""
    sys.stdout.write(render_config())
