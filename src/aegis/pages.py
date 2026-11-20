"""HTML pages: Jinja2 templates fed from the same Python constants the API uses.

Both pages share one layout (``templates/base.html``). Choices shown in the planner form and the
numbers the front end needs (AQI categories, pollutant labels, staleness and station limits) come
from here, so Python stays the single source of truth for both the API and the UI.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.templating import Jinja2Templates

from .airdata import STALE_AFTER_MINUTES
from .aqi import CATEGORIES, HAZARDOUS, POLLUTANT_LABELS
from .commute import LABELS as MODE_LABELS
from .models import Activity, Group
from .stations import RECENT_MINUTES, SEARCH_RADIUS_M

TEMPLATES = Jinja2Templates(directory=Path(__file__).parent / "templates")

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


def front_end_config() -> dict[str, Any]:
    """Constants the browser needs, rendered once into the page as JSON."""
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
    }


def page_context() -> dict[str, Any]:
    """Template variables shared by every page."""
    return {
        "config": front_end_config(),
        "groups": GROUP_CHOICES,
        "activities": ACTIVITY_CHOICES,
        "durations": DURATION_CHOICES,
        "modes": MODE_LABELS,
    }
