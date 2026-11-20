from conftest import make_snapshot

from aegis.models import Activity, Group, Member, PlannedActivity, Verdict
from aegis.planner import plan_day


def act(label, activity=Activity.WALK, hours=1, earliest=0, latest=24):
    return PlannedActivity(
        label=label,
        activity=activity,
        duration_hours=hours,
        earliest_hour=earliest,
        latest_hour=latest,
    )


def test_activities_get_distinct_clean_slots_in_input_order():
    snap = make_snapshot(hourly=[100, 30, 20, 25, 90, 120])
    plan = plan_day(snap, [act("Walk"), act("Football", Activity.RUN, 2)], [Member()])
    assert [p.label for p in plan] == ["Walk", "Football"]
    football, walk = plan[1], plan[0]
    assert football.window.start[11:16] == "12:00"  # longest placed first: 12-14 (20, 25)
    assert walk.window.start[11:16] == "11:00"
    assert football.verdict is Verdict.CAUTION  # hard exercise, good air


def test_sensitive_member_makes_schedule_stricter():
    snap = make_snapshot(hourly=[120, 120, 120])
    plan = plan_day(snap, [act("Walk")], [Member(), Member(groups=[Group.ASTHMA])])
    assert plan[0].verdict is Verdict.LIMIT
    assert "shorten" in plan[0].advice


def test_unfittable_activity_reported():
    snap = make_snapshot(hourly=[50, 50, 50])
    plan = plan_day(snap, [act("Late", earliest=20, latest=22)], [Member()])
    assert plan[0].window is None and plan[0].verdict is None
    assert "widening" in plan[0].advice


def test_half_hour_rounds_up_and_empty_plan():
    snap = make_snapshot(hourly=[10, 20])
    assert plan_day(snap, [act("Stroll", hours=0.5)], [Member()])[0].window.start[11:16] == "10:00"
    assert plan_day(snap, [], [Member()]) == []


def with_pm25(snap, values):
    hourly = [p.model_copy(update={"pm2_5": v}) for p, v in zip(snap.hourly, values, strict=True)]
    return snap.model_copy(update={"hourly": hourly})


def test_choice_impact_is_personal_exposure_vs_going_now():
    snap = with_pm25(make_snapshot(hourly=[150, 40, 30]), [100.0, 20.0, 10.0])
    item = plan_day(snap, [act("Walk")], [Member()])[0]
    assert item.window.start[11:16] == "12:00"
    # 10 µg/m³ x 0.027 m³/min (moderate, EPA EFH Table 6-2) x 60 min = 16.2 µg; now: 162 µg.
    assert (item.inhaled_pm25_ug, item.inhaled_pm25_now_ug) == (16.2, 162.0)
    assert "90% less exposure" in item.exposure_note


def test_impact_when_best_slot_is_now_and_rate_follows_intensity():
    snap = with_pm25(make_snapshot(hourly=[20, 90]), [10.0, 80.0])
    run, rest = plan_day(
        snap,
        [act("Run", Activity.RUN, latest=11), act("Read", Activity.REST, earliest=11)],
        [Member()],
    )
    assert run.inhaled_pm25_ug == run.inhaled_pm25_now_ug == 29.4  # 10 x 0.049 x 60
    assert run.exposure_note == "You would breathe in about 29.4 µg of PM2.5 in this slot."
    assert rest.inhaled_pm25_ug == 20.6  # 80 x 0.0043 x 60, worse than now: no "less" claim
    assert "less" not in rest.exposure_note


def test_missing_pm25_means_no_exposure_figure():
    snap = with_pm25(make_snapshot(hourly=[90, 20]), [50.0, None])
    item = plan_day(snap, [act("Walk")], [Member()])[0]
    assert item.inhaled_pm25_ug is None and item.exposure_note is None
    assert item.inhaled_pm25_now_ug == 81.0
