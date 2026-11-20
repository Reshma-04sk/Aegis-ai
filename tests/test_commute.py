import pytest

from aegis.commute import compare_commute
from aegis.commute.factors import FACTORS
from aegis.models import Commute, Mode


def by_mode(advice):
    return {o.mode: o for o in advice.options}


def test_emissions_and_avoided_are_consistent():
    advice = compare_commute(
        Commute(distance_km=8, current_mode=Mode.CAR_PETROL, trips_per_week=10), pm25=90
    )
    opts = by_mode(advice)
    car = opts[Mode.CAR_PETROL]
    assert car.is_current and car.emissions_kg_co2e_per_week == round(0.16152 * 80, 2)
    assert opts[Mode.METRO].emissions_avoided_kg_co2e_per_week == round((0.16152 - 0.02121) * 80, 2)
    assert Mode.WALK not in opts  # 8 km is beyond the walking limit
    assert advice.options == sorted(advice.options, key=lambda o: o.emissions_kg_co2e_per_week)


def test_carpool_divides_vehicle_factor_only():
    opts = by_mode(
        compare_commute(
            Commute(distance_km=10, current_mode=Mode.CAR_DIESEL, occupants=2, trips_per_week=1),
            pm25=None,
        )
    )
    assert opts[Mode.CAR_DIESEL].emissions_kg_co2e_per_week == round(
        FACTORS[Mode.CAR_DIESEL][0] * 10 / 2, 2
    )
    assert opts[Mode.BUS].emissions_kg_co2e_per_week == round(FACTORS[Mode.BUS][0] * 10, 2)
    assert opts[Mode.BUS].inhaled_pm25_ug_per_trip is None


def test_exposure_is_separate_and_can_rise_when_emissions_fall():
    advice = compare_commute(Commute(distance_km=5, current_mode=Mode.CAR_PETROL), pm25=100)
    opts = by_mode(advice)
    # car: 12 min sedentary; cycle: 20 min at high intensity -> more inhaled PM2.5
    assert opts[Mode.CAR_PETROL].inhaled_pm25_ug_per_trip == pytest.approx(
        100 * 4.3e-3 * 12, abs=0.1
    )
    assert (
        opts[Mode.CYCLE].inhaled_pm25_ug_per_trip > opts[Mode.CAR_PETROL].inhaled_pm25_ug_per_trip
    )
    assert "breathe in more particles" in advice.summary
    assert "kg CO2e" in advice.summary


def test_already_lowest_and_current_mode_kept_beyond_limit():
    advice = compare_commute(Commute(distance_km=10, current_mode=Mode.WALK), pm25=20)
    assert "already the lowest-emission" in advice.summary
    assert by_mode(advice)[Mode.WALK].is_current


def test_summary_without_exposure_note_when_cleaner():
    advice = compare_commute(Commute(distance_km=3, current_mode=Mode.CYCLE), pm25=50)
    assert "already the lowest-emission" in advice.summary
    advice = compare_commute(Commute(distance_km=30, current_mode=Mode.TAXI), pm25=50)
    assert "Switching from taxi to metro / tram" in advice.summary
    assert "breathe in more" not in advice.summary
