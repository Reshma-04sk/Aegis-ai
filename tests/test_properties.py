"""Property-based tests: invariants that must hold for every input, not just chosen examples.

Hypothesis generates hundreds of cases per property (including boundaries, NaN, infinities,
huge and negative numbers, and arbitrary Unicode) and shrinks any failure to a minimal example.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta

from hypothesis import given, settings
from hypothesis import strategies as st

from aegis.aqi import CATEGORIES, HAZARDOUS, categorize, category_index
from aegis.cache import TTLCache
from aegis.models import HourlyPoint, Verdict
from aegis.profiles import extract_from_note
from aegis.rules import STRICTNESS, cleanest_window, strictest, verdict_for
from aegis.security import RateLimiter
from aegis.stations.geo import haversine_km
from aegis.stations.values import measured_value

settings.register_profile("ci", max_examples=300, deadline=None)
settings.load_profile("ci")

aqi_values = st.floats(min_value=0, max_value=1000, allow_nan=False)
rank = STRICTNESS.index


# ---------------------------------------------------------------- health rules


@given(aqi_values, aqi_values, st.booleans(), st.booleans())
def test_worse_air_never_gives_a_looser_verdict(
    a: float, b: float, sensitive: bool, hard: bool
) -> None:
    low, high = sorted((a, b))
    assert rank(verdict_for(low, sensitive=sensitive, hard_exercise=hard)) <= rank(
        verdict_for(high, sensitive=sensitive, hard_exercise=hard)
    )


@given(aqi_values, st.booleans())
def test_sensitive_people_and_hard_exercise_are_never_treated_more_loosely(
    aqi: float, hard: bool
) -> None:
    general = verdict_for(aqi, sensitive=False, hard_exercise=hard)
    assert rank(verdict_for(aqi, sensitive=True, hard_exercise=hard)) >= rank(general)
    assert rank(verdict_for(aqi, sensitive=False, hard_exercise=True)) >= rank(
        verdict_for(aqi, sensitive=False, hard_exercise=False)
    )


@given(st.lists(st.sampled_from(list(Verdict))))
def test_household_follows_its_strictest_member(verdicts: list[Verdict]) -> None:
    result = strictest(verdicts)
    assert all(rank(result) >= rank(v) for v in verdicts)
    assert result in verdicts or (not verdicts and result is Verdict.GO)


@given(aqi_values, aqi_values)
def test_epa_categories_are_ordered_and_named(a: float, b: float) -> None:
    low, high = sorted((a, b))
    assert category_index(low) <= category_index(high)
    assert categorize(low) in {name for name, _ in CATEGORIES} | {HAZARDOUS}


# ---------------------------------------------------------------- cleanest window

START = datetime(2026, 11, 20, tzinfo=UTC)
hour_values = st.one_of(st.none(), st.floats(min_value=0, max_value=500, allow_nan=False))


def _hourly(values: list[float | None]) -> list[HourlyPoint]:
    return [
        HourlyPoint(time=(START + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M"), us_aqi=v)
        for i, v in enumerate(values)
    ]


def _valid_blocks(
    values: list[float | None], hours: int, earliest: int, latest: int
) -> list[float]:
    """Spec, stated independently: means of complete blocks inside [earliest, latest)."""
    means = []
    for start in range(len(values) - hours + 1):
        block = values[start : start + hours]
        hour = (START + timedelta(hours=start)).hour
        if hour < earliest or hour + hours > latest or any(v is None for v in block):
            continue
        means.append(sum(v for v in block if v is not None) / hours)
    return means


@given(
    st.lists(hour_values, min_size=1, max_size=24),
    st.integers(min_value=1, max_value=6),
    st.integers(min_value=0, max_value=23),
    st.integers(min_value=1, max_value=24),
)
def test_cleanest_window_is_the_true_minimum_and_respects_limits(
    values: list[float | None], hours: int, earliest: int, latest: int
) -> None:
    window = cleanest_window(_hourly(values), hours, earliest, latest)
    candidates = _valid_blocks(values[:24], hours, earliest, latest)
    if window is None:
        assert candidates == []
        return
    begin = datetime.fromisoformat(window.start)
    assert earliest <= begin.hour and begin.hour + hours <= latest
    assert datetime.fromisoformat(window.end) - begin == timedelta(hours=hours)
    assert math.isclose(window.mean_aqi, min(candidates), abs_tol=0.051)  # rounded to 0.1


# ---------------------------------------------------------------- untrusted data

anything = st.one_of(
    st.none(),
    st.booleans(),
    st.integers(),
    st.floats(),  # includes NaN and +/- infinity
    st.text(),
    st.lists(st.integers(), max_size=3),
    st.dictionaries(st.text(max_size=3), st.integers(), max_size=2),
)


@given(anything)
def test_station_values_are_finite_non_negative_or_missing(raw: object) -> None:
    value = measured_value(raw)
    assert value is None or (math.isfinite(value) and value >= 0)


@given(st.text(max_size=300))
def test_any_note_is_parsed_without_error(note: str) -> None:
    groups, activity = extract_from_note(note)
    assert isinstance(groups, set) and (activity is None or activity.value)


coords = st.tuples(
    st.floats(min_value=-90, max_value=90, allow_nan=False),
    st.floats(min_value=-180, max_value=180, allow_nan=False),
)


@given(coords, coords)
def test_distance_is_a_metric_on_the_sphere(p: tuple[float, float], q: tuple[float, float]) -> None:
    d = haversine_km(*p, *q)
    assert 0 <= d <= 20_016  # half of Earth's circumference
    assert math.isclose(d, haversine_km(*q, *p), abs_tol=1e-6)
    assert haversine_km(*p, *p) == 0


# ---------------------------------------------------------------- bounded resources


@given(st.lists(st.text(max_size=4), max_size=200), st.integers(min_value=1, max_value=16))
def test_cache_never_exceeds_its_bound(keys: list[str], bound: int) -> None:
    cache: TTLCache[int] = TTLCache(ttl_seconds=60, max_entries=bound)
    for i, key in enumerate(keys):
        cache.put(key, i)
        assert len(cache._items) <= bound
    if keys:
        assert cache.get(keys[-1]) == len(keys) - 1  # the newest entry always survives


@given(st.integers(min_value=1, max_value=20), st.integers(min_value=0, max_value=60))
def test_rate_limiter_never_allows_more_than_the_limit(limit: int, attempts: int) -> None:
    limiter = RateLimiter(limit, window_seconds=3600, max_clients=4)
    allowed = sum(limiter.check("client") == 0 for _ in range(attempts))
    assert allowed == min(limit, attempts)
