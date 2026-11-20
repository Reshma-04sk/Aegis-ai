"""The front end is built from the same Python constants the API uses (one source of truth)."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from aegis.api import create_app
from aegis.api.pages import STATIC_DIR
from aegis.aqi import CATEGORIES, POLLUTANT_LABELS
from aegis.commute import LABELS as MODE_LABELS
from aegis.config import Settings
from aegis.freshness import STALE_AFTER_MINUTES
from aegis.frontend import ACTIVITY_CHOICES, GROUP_CHOICES, front_end_config, main, render_config
from aegis.models import Activity, Group, Mode

GENERATED = Path(__file__).parent.parent / "web" / "src" / "generated" / "config.json"


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
    assert [m["value"] for m in config["modes"]] == [str(m) for m in MODE_LABELS]
    assert {g["value"] for g in config["groups"]} == {str(g) for g in Group}


def test_generated_config_file_is_current():
    """Regenerate with `uv run aegis-config > web/src/generated/config.json` when this fails."""
    assert GENERATED.read_text(encoding="utf-8") == render_config()
    assert json.loads(render_config()) == front_end_config()


def test_console_entry_prints_the_config(capsys):
    main()
    assert capsys.readouterr().out == render_config()


@pytest.mark.skipif(not (STATIC_DIR / "index.html").exists(), reason="run `npm run build` first")
def test_pages_are_the_prerendered_build():
    with TestClient(create_app(Settings())) as client:
        landing, planner = client.get("/"), client.get("/plan")
    assert landing.status_code == planner.status_code == 200
    assert landing.headers["content-type"].startswith("text/html")
    # Prerendered: the content is in the HTML before any script runs.
    assert "<h1" in landing.text and 'id="planner-title"' in planner.text
    assert "within 25 km" in landing.text  # limits in the copy come from the station constants
    assert landing.headers["cache-control"] == "no-cache"
