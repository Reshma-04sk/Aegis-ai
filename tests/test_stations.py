import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import respx

from aegis.stations import (
    OPENAQ_URL,
    OpenAQClient,
    build_observation,
    haversine_km,
    pick_station,
)

NOW = datetime.now(UTC)
LOCATIONS = f"{OPENAQ_URL}/locations"


def iso(minutes_ago):
    """Relative to the current time, so long-running fixture servers stay fresh."""
    when = datetime.now(UTC) - timedelta(minutes=minutes_ago)
    return when.strftime("%Y-%m-%dT%H:%M:%SZ")


def location(loc_id, lat, lon, minutes_ago=30, **kw):
    """Shape from docs.openaq.org /v3/locations."""
    return {
        "id": loc_id,
        "name": kw.get("name", f"Station {loc_id}"),
        "provider": {"id": 1, "name": kw.get("provider", "CPCB")},
        "isMonitor": kw.get("monitor", True),
        "sensors": [
            {
                "id": loc_id * 10 + 2,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
            },
            {
                "id": loc_id * 10 + 7,
                "parameter": {"id": 7, "name": "no2", "units": "ppm", "displayName": "NO₂"},
            },
            {"id": loc_id * 10 + 99, "parameter": {"id": 99, "name": "temperature", "units": "c"}},
        ],
        "coordinates": {"latitude": lat, "longitude": lon},
        "licenses": kw.get(
            "licenses", [{"attribution": {"name": "Central Pollution Control Board", "url": None}}]
        ),
        "datetimeLast": {"utc": iso(minutes_ago)},
    }


def latest(loc_id, pm25=98.0, no2=0.05, minutes_ago=30):
    """Shape from docs.openaq.org /v3/locations/{id}/latest."""
    return {
        "results": [
            {"datetime": {"utc": iso(minutes_ago)}, "value": pm25, "sensorsId": loc_id * 10 + 2},
            {"datetime": {"utc": iso(minutes_ago)}, "value": no2, "sensorsId": loc_id * 10 + 7},
            {"datetime": {"utc": iso(5)}, "value": 21.0, "sensorsId": loc_id * 10 + 99},
        ]
    }


def test_haversine_known_distance():
    # Delhi (Connaught Place) to Gurugram is about 25-27 km.
    assert 24 < haversine_km(28.6315, 77.2167, 28.4595, 77.0266) < 28
    assert haversine_km(1, 2, 1, 2) == 0


def test_pick_station_takes_nearest_recent_and_skips_bad_rows():
    rows = [
        location(1, 28.70, 77.10),  # ~10 km
        location(2, 28.62, 77.21),  # nearest
        location(3, 28.6139, 77.209, minutes_ago=3 * 24 * 60),  # closest but silent for days
        {"id": 4, "coordinates": {}},
        {**location(5, 28.61, 77.20), "datetimeLast": {"utc": "not a date"}},
        {**location(6, 28.61, 77.20), "datetimeLast": {"utc": "2026-11-19T10:00:00"}},  # naive
    ]
    loc, distance = pick_station(rows, 28.6139, 77.2090, NOW)
    assert loc["id"] == 2 and distance < 2
    assert pick_station([], 0, 0, NOW) is None


def test_observation_keeps_provider_units_and_provenance():
    obs = build_observation(
        location(7, 28.6, 77.2), 3.14159, latest(7)["results"], datetime.now(UTC)
    )
    assert (obs.station_id, obs.provider, obs.distance_km) == (7, "CPCB", 3.1)
    assert obs.attribution.startswith("Measurements by Central Pollution Control Board")
    assert [r.pollutant for r in obs.readings] == ["pm25", "no2"]  # temperature dropped
    pm25, no2 = obs.readings
    assert pm25.kind == "station_observation" and pm25.value == 98.0 and pm25.unit == "µg/m³"
    assert no2.unit == "ppm"  # gases stay in the provider's unit, never converted
    assert pm25.data_age_minutes == 30 and not pm25.stale and pm25.retrieved_at.endswith("Z")


def test_invalid_values_stay_missing_and_old_readings_are_stale():
    rows = latest(8, pm25=-999, no2=True, minutes_ago=200)["results"]
    rows.append({"datetime": {"utc": "bad"}, "value": 5, "sensorsId": 12345})  # unknown sensor
    obs = build_observation(location(8, 28.6, 77.2, licenses=[]), 1, rows, datetime.now(UTC))
    assert [r.value for r in obs.readings] == [None, None]
    assert all(r.stale and r.data_age_minutes == 200 for r in obs.readings)
    assert obs.attribution == "Measurements by CPCB, via OpenAQ (openaq.org)."


def test_unparseable_time_is_stale_and_no_known_pollutant_means_none():
    obs = build_observation(
        location(9, 0, 0), 1, [{"datetime": {}, "value": 4, "sensorsId": 92}], NOW
    )
    assert obs.readings[0].observed_at is None and obs.readings[0].stale
    assert build_observation(location(9, 0, 0), 1, [{"value": 1, "sensorsId": 999}], NOW) is None


async def test_no_key_means_not_configured_without_any_request():
    async with httpx.AsyncClient() as http:
        assert await OpenAQClient(http, "", 600).nearest(28.6, 77.2) == (None, "not_configured")


@respx.mock
async def test_nearest_station_success_sends_key_and_caches():
    search = respx.get(LOCATIONS).mock(
        return_value=httpx.Response(200, json={"results": [location(11, 28.62, 77.21)]})
    )
    last = respx.get(f"{LOCATIONS}/11/latest").mock(
        return_value=httpx.Response(200, json=latest(11))
    )
    async with httpx.AsyncClient() as http:
        client = OpenAQClient(http, "secret", 600)
        obs, status = await client.nearest(28.6139, 77.2090)
        again, _ = await client.nearest(28.6105, 77.2088)  # same cache cell, different spot
    assert status == "ok" and obs.station_id == 11 == again.station_id
    assert again.distance_km != obs.distance_km  # distance recomputed per caller
    request = search.calls[0].request
    assert request.headers["x-api-key"] == "secret"
    assert request.url.params["coordinates"] == "28.6139,77.2090"
    assert request.url.params["radius"] == "25000" and request.url.params["parameters_id"] == "2"
    assert request.url.params["monitor"] == "true"
    assert search.call_count == 1 and last.call_count == 1


@respx.mock
@pytest.mark.parametrize(
    "results",
    [[], [location(12, 28.6, 77.2, minutes_ago=5000)]],
)
async def test_no_recent_station_nearby(results):
    respx.get(LOCATIONS).mock(return_value=httpx.Response(200, json={"results": results}))
    async with httpx.AsyncClient() as http:
        assert await OpenAQClient(http, "k", 600).nearest(28.6, 77.2) == (None, "none_nearby")


@respx.mock
async def test_station_without_usable_readings_is_none_nearby():
    respx.get(LOCATIONS).mock(
        return_value=httpx.Response(200, json={"results": [location(13, 28.6, 77.2)]})
    )
    respx.get(f"{LOCATIONS}/13/latest").mock(return_value=httpx.Response(200, json={}))
    async with httpx.AsyncClient() as http:
        assert await OpenAQClient(http, "k", 600).nearest(28.6, 77.2) == (None, "none_nearby")


@respx.mock
@pytest.mark.parametrize("status", [401, 429, 503])
async def test_failures_are_unavailable_and_not_cached(monkeypatch, status):
    monkeypatch.setattr("aegis.airdata.RETRY_BACKOFF_SECONDS", 0)
    route = respx.get(LOCATIONS).mock(return_value=httpx.Response(status))
    async with httpx.AsyncClient() as http:
        client = OpenAQClient(http, "k", 600)
        assert await client.nearest(28.6, 77.2) == (None, "unavailable")
        await client.nearest(28.6, 77.2)
    retries = 1 if status == 401 else 3  # bounded retries for 429/5xx only
    assert route.call_count == 2 * retries


@respx.mock
async def test_malformed_location_row_is_unavailable():
    bad = location(14, 28.6, 77.2)
    bad["id"] = "not-a-number"
    respx.get(LOCATIONS).mock(return_value=httpx.Response(200, json={"results": [bad]}))
    async with httpx.AsyncClient() as http:
        assert await OpenAQClient(http, "k", 600).nearest(28.6, 77.2) == (None, "unavailable")


@pytest.mark.parametrize("raw", [float("nan"), float("inf"), -1.0, "12", None])
def test_non_finite_or_non_numeric_values_stay_missing(raw):
    rows = [{"datetime": {"utc": iso(10)}, "value": raw, "sensorsId": 152}]
    obs = build_observation(location(15, 0, 0), 1, rows, datetime.now(UTC))
    assert obs.readings[0].value is None


def test_future_timestamp_is_unknown_not_fresh():
    rows = [{"datetime": {"utc": iso(-60)}, "value": 40, "sensorsId": 162}]
    reading = build_observation(location(16, 0, 0), 1, rows, datetime.now(UTC)).readings[0]
    assert reading.data_age_minutes is None and reading.observed_at is None and reading.stale


def test_duplicate_pollutant_sensors_keep_the_freshest():
    loc = location(17, 0, 0)
    loc["sensors"].append({"id": 9999, "parameter": loc["sensors"][0]["parameter"]})
    rows = [
        {"datetime": {"utc": iso(20)}, "value": 50, "sensorsId": 172},
        {"datetime": {"utc": iso(90)}, "value": 70, "sensorsId": 9999},  # older: ignored
        {"datetime": {"utc": iso(5)}, "value": 60, "sensorsId": 9999},  # fresher: wins
    ]
    reading = build_observation(loc, 1, rows, datetime.now(UTC)).readings[0]
    assert (reading.value, reading.data_age_minutes) == (60.0, 5)


@respx.mock
@pytest.mark.parametrize(
    "payload",
    [
        {"results": ["x"]},
        {"results": "not a list"},
        {"results": [{**location(18, 28.6, 77.2), "coordinates": "28.6,77.2"}]},
        {"results": [{**location(18, 28.6, 77.2), "datetimeLast": "yesterday"}]},
        {"results": [{**location(18, 28.6, 77.2), "id": float("inf")}]},
    ],
)
async def test_malformed_payloads_never_fail_the_plan(payload):
    body = json.dumps(payload).encode()  # stdlib emits Infinity, as a broken upstream might
    respx.get(LOCATIONS).mock(
        return_value=httpx.Response(200, content=body, headers={"content-type": "application/json"})
    )
    async with httpx.AsyncClient() as http:
        obs, status = await OpenAQClient(http, "k", 600).nearest(28.6, 77.2)
    assert obs is None and status in {"unavailable", "none_nearby"}


@respx.mock
async def test_malformed_latest_rows_never_fail_the_plan():
    respx.get(LOCATIONS).mock(
        return_value=httpx.Response(200, json={"results": [location(19, 28.6, 77.2)]})
    )
    respx.get(f"{LOCATIONS}/19/latest").mock(
        return_value=httpx.Response(200, json={"results": [{"datetime": "now", "sensorsId": 192}]})
    )
    async with httpx.AsyncClient() as http:
        assert await OpenAQClient(http, "k", 600).nearest(28.6, 77.2) == (None, "unavailable")


def test_readings_older_than_a_day_are_left_out():
    rows = latest(20, minutes_ago=2 * 24 * 60)["results"]
    rows.append({"datetime": {"utc": iso(15)}, "value": 41, "sensorsId": 202})
    obs = build_observation(location(20, 0, 0), 1, rows, datetime.now(UTC))
    assert [(r.pollutant, r.value) for r in obs.readings] == [("pm25", 41.0)]
