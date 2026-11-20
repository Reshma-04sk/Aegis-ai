from datetime import UTC, datetime

import httpx
import pytest
import respx

from aegis.airdata import OpenMeteoClient, parse_air_response, parse_weather
from aegis.airdata.openmeteo import AIR_URL, GEOCODE_URL, WEATHER_URL
from aegis.cache import TTLCache
from aegis.errors import AirDataError, LocationNotFoundError

GEO = {
    "results": [
        {
            "name": "Kadapa",
            "admin1": "Andhra Pradesh",
            "country": "India",
            "latitude": 14.48,
            "longitude": 78.82,
        }
    ]
}
AIR = {
    "timezone": "Asia/Kolkata",
    "utc_offset_seconds": 19800,
    "current": {
        "time": "2026-11-19T18:00",
        "us_aqi": 120,
        "pm2_5": 40.0,
        "us_aqi_pm2_5": 120,
        "us_aqi_ozone": 30,
    },
    "hourly": {
        "time": [f"2026-11-19T{h:02d}:00" for h in range(16, 24)] + ["2026-11-20T00:00"],
        "us_aqi": [100, 110, 120, 130, None, 90, 80, 70, 60],
        "pm2_5": [30, 35, 40, 45, None, 30, 25, 20],
    },
}
WEATHER = {
    "hourly": {
        "time": ["2026-11-19T17:00", "2026-11-19T18:00", "2026-11-19T19:00", "2026-11-19T20:00"],
        "wind_speed_10m": [5, 3.5, 4, 6],
        "boundary_layer_height": [300, 120, None, 600],
    }
}
NOW = datetime(2026, 11, 19, 12, 50, tzinfo=UTC)  # 18:20 IST, 20 minutes after 18:00 local


def test_parse_uses_current_hour_and_keeps_missing_values():
    snap = parse_air_response(AIR, ("Kadapa", 14.48, 78.82), now=NOW)
    assert snap.aqi == 120
    assert snap.hourly[0].time == "2026-11-19T18:00" and snap.hourly[0].pm2_5 == 40
    assert snap.sub_indices["pm2_5"] == 120 and snap.sub_indices["pm10"] is None
    assert snap.hourly[2].us_aqi is None and snap.hourly[2].pm2_5 is None
    assert snap.hourly[-1].pm2_5 is None  # shorter pm2_5 array stays missing, not invented


def test_provenance_age_and_staleness():
    prov = parse_air_response(AIR, ("K", 0, 0), now=NOW).provenance
    assert prov.kind == "model_estimate" and prov.data_age_minutes == 20 and not prov.stale
    assert "Open-Meteo" in prov.attribution and prov.retrieved_at == "2026-11-19T12:50:00Z"
    late = parse_air_response(AIR, ("K", 0, 0), now=NOW.replace(hour=15)).provenance
    assert late.stale and late.data_age_minutes == 200


def test_parse_rejects_missing_current_or_time():
    for bad in ({"current": {}}, {}, {"current": {"us_aqi": 5, "time": "nonsense"}}):
        with pytest.raises(AirDataError):
            parse_air_response(bad, ("x", 0, 0))


def test_parse_ignores_bool_and_strings():
    data = {"current": {"time": "2026-11-19T10:00", "us_aqi": 10, "pm2_5": True, "pm10": "5"}}
    snap = parse_air_response(data, ("x", 0, 0), now=NOW)
    assert snap.pollutants["pm2_5"] is None and snap.pollutants["pm10"] is None
    assert snap.weather is None


def test_parse_weather():
    w = parse_weather(WEATHER, "2026-11-19T18")
    assert (w.wind_speed_kmh, w.boundary_layer_m) == (3.5, 120)
    assert (w.peak_mixing_time, w.peak_boundary_layer_m) == ("2026-11-19T20:00", 600)
    assert parse_weather(WEATHER, "2026-11-21T00") is None
    assert parse_weather({"hourly": "x"}, "2026-11-19T18") is None
    assert parse_weather(None, "2026-11-19T18") is None


@respx.mock
async def test_snapshot_by_name_geocodes_then_caches():
    geo = respx.get(GEOCODE_URL).mock(return_value=httpx.Response(200, json=GEO))
    air = respx.get(AIR_URL).mock(return_value=httpx.Response(200, json=AIR))
    weather = respx.get(WEATHER_URL).mock(return_value=httpx.Response(200, json=WEATHER))
    async with httpx.AsyncClient() as http:
        client = OpenMeteoClient(http)
        first = await client.snapshot(location="Kadapa", latitude=None, longitude=None)
        second = await client.snapshot(location="kadapa", latitude=None, longitude=None)
    assert first.location_name == "Kadapa, Andhra Pradesh, India" == second.location_name
    assert first.weather.boundary_layer_m == 120
    assert geo.call_count == 1 and air.call_count == 1 and weather.call_count == 1


@respx.mock
async def test_coordinate_label_is_not_shared_through_cache():
    respx.get(AIR_URL).mock(return_value=httpx.Response(200, json=AIR))
    respx.get(WEATHER_URL).mock(return_value=httpx.Response(500))
    async with httpx.AsyncClient() as http:
        client = OpenMeteoClient(http)
        a = await client.snapshot(location="Spoofed label", latitude=14.481, longitude=78.82)
        b = await client.snapshot(location=None, latitude=14.48, longitude=78.82)
    assert a.location_name == "14.48, 78.82" == b.location_name
    assert a.weather is None  # weather failure never fails the request


@respx.mock
async def test_unknown_place_and_missing_location():
    respx.get(GEOCODE_URL).mock(return_value=httpx.Response(200, json={}))
    async with httpx.AsyncClient() as http:
        client = OpenMeteoClient(http)
        with pytest.raises(LocationNotFoundError):
            await client.snapshot(location="Atlantis", latitude=None, longitude=None)
        with pytest.raises(LocationNotFoundError):
            await client.snapshot(location=None, latitude=None, longitude=None)


@respx.mock
@pytest.mark.parametrize(
    "response",
    [httpx.Response(503), httpx.Response(200, text="not json"), httpx.Response(200, json=[1, 2])],
)
async def test_upstream_failures_become_air_data_errors(response):
    respx.get(AIR_URL).mock(return_value=response)
    respx.get(WEATHER_URL).mock(return_value=httpx.Response(200, json=WEATHER))
    async with httpx.AsyncClient() as http:
        with pytest.raises(AirDataError):
            await OpenMeteoClient(http).snapshot(location=None, latitude=1, longitude=2)


@pytest.fixture(autouse=True)
def _no_backoff(monkeypatch):
    monkeypatch.setattr("aegis.fetch.RETRY_BACKOFF_SECONDS", 0)


@respx.mock
@pytest.mark.parametrize("blip", [httpx.Response(503), httpx.ConnectError("blip")])
async def test_transient_failures_are_retried(blip):
    air = respx.get(AIR_URL).mock(side_effect=[blip, blip, httpx.Response(200, json=AIR)])
    respx.get(WEATHER_URL).mock(return_value=httpx.Response(200, json=WEATHER))
    async with httpx.AsyncClient() as http:
        snap = await OpenMeteoClient(http).snapshot(location=None, latitude=1, longitude=2)
    assert snap.aqi is not None and air.call_count == 3


@respx.mock
async def test_retry_is_bounded_and_client_errors_are_not_retried():
    air = respx.get(AIR_URL).mock(return_value=httpx.Response(503))
    respx.get(WEATHER_URL).mock(return_value=httpx.Response(200, json=WEATHER))
    async with httpx.AsyncClient() as http:
        client = OpenMeteoClient(http)
        with pytest.raises(AirDataError):
            await client.snapshot(location=None, latitude=1, longitude=2)
        assert air.call_count == 3
        air.mock(return_value=httpx.Response(400))
        with pytest.raises(AirDataError):
            await client.snapshot(location=None, latitude=3, longitude=4)
    assert air.call_count == 4


@respx.mock
async def test_network_error_mapped():
    respx.get(AIR_URL).mock(side_effect=httpx.ConnectError("boom"))
    respx.get(WEATHER_URL).mock(side_effect=httpx.ConnectError("boom"))
    async with httpx.AsyncClient() as http:
        with pytest.raises(AirDataError, match="did not respond"):
            await OpenMeteoClient(http).snapshot(location=None, latitude=1, longitude=2)


def test_ttl_cache_expiry_and_bound(monkeypatch):
    now = [0.0]
    monkeypatch.setattr("aegis.cache.time.monotonic", lambda: now[0])
    cache = TTLCache[int](ttl_seconds=10, max_entries=2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.put("a", 3)  # update in place does not evict
    assert cache.get("b") == 2
    cache.put("c", 4)
    assert cache.get("a") is None and cache.get("c") == 4
    first, second = cache.pop("c"), cache.pop("c")  # single use: the second pop finds nothing
    assert first == 4 and second is None
    cache.put("d", 5)
    now[0] = 11
    assert cache.get("d") is None
