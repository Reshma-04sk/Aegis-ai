import math

import pytest
from conftest import make_snapshot

from aegis.indoor import advise_indoor, recommended_cadr_m3h
from aegis.models import Home, Verdict


def test_recommended_cadr_matches_epa_chart():
    # EPA chart: 200 ft² room -> 130 cfm at an 8 ft ceiling.
    home = Home(floor_area_m2=200 / 10.7639, ceiling_height_m=2.4384)
    assert recommended_cadr_m3h(home) == pytest.approx(130 * 1.69901, rel=1e-3)


def test_purifier_maths_and_adequacy():
    home = Home(floor_area_m2=15, ceiling_height_m=2.5, purifier_cadr_m3h=300)
    advice = advise_indoor(make_snapshot(aqi=180), home, Verdict.LIMIT)
    assert advice.room_volume_m3 == 37.5
    assert advice.clean_air_changes_per_hour == 8.0
    assert advice.minutes_to_cut_particles_90pct == round(math.log(10) / 8 * 60)
    assert advice.purifier_adequate is True
    assert any("windows" in t for t in advice.tips)


def test_undersized_purifier_flagged():
    home = Home(floor_area_m2=30, purifier_cadr_m3h=100)
    advice = advise_indoor(make_snapshot(aqi=60), home, Verdict.CAUTION)
    assert advice.purifier_adequate is False
    assert "undersized" in advice.tips[-1]


def test_no_purifier_and_airing_window():
    advice = advise_indoor(
        make_snapshot(aqi=150, hourly=[150, 140, 60, 100]), Home(floor_area_m2=12), Verdict.GO
    )
    assert advice.clean_air_changes_per_hour is None and advice.purifier_adequate is None
    assert advice.tips[0].startswith("Air the home briefly around 12:00")
    assert not any("windows and doors shut" in t for t in advice.tips)


def test_polluted_day_without_improvement():
    advice = advise_indoor(
        make_snapshot(aqi=50, hourly=[50, 200, 210]), Home(floor_area_m2=12), Verdict.AVOID
    )
    assert advice.tips[0].startswith("Keep airing short")


def test_clean_day_with_no_better_hour_gives_no_airing_tip():
    advice = advise_indoor(
        make_snapshot(aqi=30, hourly=[30, 40, 50]), Home(floor_area_m2=12), Verdict.GO
    )
    assert advice.airing_window is not None and advice.airing_window.starts_now
    assert not any(t.startswith(("Air the home", "Keep airing")) for t in advice.tips)
