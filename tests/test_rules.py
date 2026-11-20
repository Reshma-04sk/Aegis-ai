import pytest
from conftest import make_snapshot

from aegis.models import Activity, Group, HourlyPoint, Member, Verdict
from aegis.rules import advise_member, cleanest_window, strictest, verdict_for


@pytest.mark.parametrize(
    ("aqi", "sensitive", "hard", "expected"),
    [
        (40, False, False, Verdict.GO),
        (90, False, False, Verdict.GO),
        (120, False, False, Verdict.CAUTION),
        (180, False, False, Verdict.LIMIT),
        (250, False, False, Verdict.AVOID),
        (400, False, False, Verdict.AVOID),
        (40, True, False, Verdict.GO),
        (60, True, False, Verdict.CAUTION),
        (120, True, False, Verdict.LIMIT),
        (160, True, False, Verdict.AVOID),
        (40, False, True, Verdict.CAUTION),
        (120, False, True, Verdict.LIMIT),
        (160, True, True, Verdict.AVOID),
    ],
)
def test_verdict_matrix(aqi, sensitive, hard, expected):
    assert verdict_for(aqi, sensitive=sensitive, hard_exercise=hard) is expected


def test_same_air_differs_by_person():
    snap = make_snapshot(aqi=120)
    adult = advise_member(snap, Member(name="Dad"), Activity.WALK)
    child = advise_member(snap, Member(name="Kid", groups=[Group.CHILD]), Activity.WALK)
    assert adult.verdict is Verdict.CAUTION and child.verdict is Verdict.LIMIT
    assert any("Sensitive-group" in r for r in child.reasons)
    assert any("outdoor play" in a for a in child.actions)


def test_go_has_no_group_actions_and_hard_exercise_reason():
    snap = make_snapshot(aqi=20)
    advice = advise_member(snap, Member(groups=[Group.ASTHMA]), Activity.RUN)
    assert advice.verdict is Verdict.CAUTION
    assert any("breathing much more air" in r for r in advice.reasons)
    go = advise_member(snap, Member(groups=[Group.ASTHMA]), Activity.REST)
    assert go.verdict is Verdict.GO and len(go.actions) == 1


def test_avoid_points_to_health_authority_without_diagnosis():
    advice = advise_member(make_snapshot(aqi=320), Member(), Activity.WALK)
    assert advice.verdict is Verdict.AVOID
    assert any("local health authority" in a for a in advice.actions)


def test_no_dominant_pollutant():
    advice = advise_member(make_snapshot(aqi=120, sub={"pm2_5": None}), Member(), Activity.WALK)
    assert len(advice.reasons) == 1


def test_strictest():
    assert strictest([Verdict.GO, Verdict.LIMIT, Verdict.CAUTION]) is Verdict.LIMIT
    assert strictest([]) is Verdict.GO


def test_cleanest_window_finds_lowest_block():
    snap = make_snapshot(hourly=[100, 90, 40, 45, 90, 120])
    w = cleanest_window(snap.hourly, 2)
    assert (w.start[11:16], w.end[11:16], w.mean_aqi, w.starts_now) == (
        "12:00",
        "14:00",
        42.5,
        False,
    )


def test_cleanest_window_skips_missing_and_respects_hours():
    snap = make_snapshot(hourly=[50, None, 10, 20, 30, 40])
    assert cleanest_window(snap.hourly, 2).start[11:16] == "12:00"
    assert cleanest_window(snap.hourly, 1, earliest_hour=14).start[11:16] == "14:00"
    assert cleanest_window(snap.hourly, 1, latest_hour=11).start[11:16] == "10:00"
    assert cleanest_window(snap.hourly, 7) is None


def test_cleanest_window_crosses_midnight_and_avoids_taken():
    snap = make_snapshot(hourly=[90, 10, 80], start_hour=23)
    w = cleanest_window(snap.hourly, 1)
    assert w.start == "2026-11-20T00:00"
    from datetime import datetime

    taken = [
        (datetime.fromisoformat("2026-11-20T00:00"), datetime.fromisoformat("2026-11-20T01:00"))
    ]
    assert cleanest_window(snap.hourly, 1, taken=taken).start == "2026-11-20T01:00"


def test_cleanest_window_empty():
    assert cleanest_window([HourlyPoint(time="2026-11-19T10:00", us_aqi=None)], 1) is None
