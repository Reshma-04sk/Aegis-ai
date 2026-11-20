import pytest

from aegis.models import AirSnapshot, HourlyPoint, Provenance, Weather


def make_snapshot(aqi: float = 80, hourly: list[float | None] | None = None, **kw) -> AirSnapshot:
    values = hourly if hourly is not None else [aqi, 60, 40, 45, 90, 120]
    start = kw.get("start_hour", 10)
    return AirSnapshot(
        location_name=kw.get("name", "Testville, Land"),
        latitude=1.0,
        longitude=2.0,
        timezone="UTC",
        aqi=aqi,
        pollutants={"pm2_5": kw.get("pm25", 30.0), "pm10": None},
        sub_indices=kw.get("sub", {"pm2_5": aqi, "ozone": 20.0, "pm10": None}),
        hourly=[
            HourlyPoint(
                time=f"2026-11-{19 + (start + i) // 24}T{(start + i) % 24:02d}:00",
                us_aqi=v,
                pm2_5=30.0,
            )
            for i, v in enumerate(values)
        ],
        provenance=Provenance(
            observed_at="2026-11-19T10:00",
            retrieved_at="2026-11-19T10:05:00Z",
            data_age_minutes=kw.get("age", 5),
            stale=kw.get("age", 5) > 180,
        ),
        weather=kw.get(
            "weather",
            Weather(
                wind_speed_kmh=4,
                boundary_layer_m=150,
                peak_mixing_time="2026-11-19T14:00",
                peak_boundary_layer_m=900,
            ),
        ),
    )


@pytest.fixture
def snapshot() -> AirSnapshot:
    return make_snapshot()
