"""Pages are rendered from the same Python constants the API uses (one source of truth)."""

import json
import re

from fastapi.testclient import TestClient

from aegis.api import create_app
from aegis.aqi import CATEGORIES, POLLUTANT_LABELS
from aegis.commute import LABELS as MODE_LABELS
from aegis.config import Settings
from aegis.freshness import STALE_AFTER_MINUTES
from aegis.models import Activity, Group, Mode
from aegis.templating import ACTIVITY_CHOICES, GROUP_CHOICES, front_end_config


def test_every_enum_value_has_a_form_label():
    assert set(GROUP_CHOICES) == set(Group)
    assert set(ACTIVITY_CHOICES) == set(Activity)
    assert set(MODE_LABELS) == set(Mode)


def test_front_end_config_mirrors_python_constants():
    config = front_end_config()
    bands = config["categories"]
    assert [(b["name"], b["max"]) for b in bands[:-1]] == list(CATEGORIES)
    assert bands[-1]["max"] is None  # Hazardous has no upper bound
    assert len({b["key"] for b in bands}) == len({b["icon"] for b in bands}) == len(bands)
    assert config["pollutantLabels"] == POLLUTANT_LABELS
    assert config["staleAfterHours"] * 60 == STALE_AFTER_MINUTES


def _config_in(html: str) -> dict[str, object]:
    found = re.search(
        r'<script type="application/json" id="aegis-config">(.*?)</script>', html, re.DOTALL
    )
    assert found
    return json.loads(found.group(1))


def test_pages_embed_the_config_and_render_choices_from_enums():
    with TestClient(create_app(Settings())) as client:
        landing, planner = client.get("/").text, client.get("/plan").text
    assert _config_in(landing) == _config_in(planner) == front_end_config()
    for mode, label in MODE_LABELS.items():
        assert f'<option value="{mode}">{label}</option>' in planner
    for group in Group:
        assert f'value="{group}"' in planner
    assert 'class="sky-is-clear"' in planner and 'class="sky-is-clear"' not in landing
    assert "within 25 km" in landing  # limits in the copy come from the station constants
