import pytest

from aegis.aqi import categorize, category_index, dominant_pollutant


@pytest.mark.parametrize(
    ("aqi", "name"),
    [
        (0, "Good"),
        (50, "Good"),
        (51, "Moderate"),
        (100, "Moderate"),
        (101, "Unhealthy for Sensitive Groups"),
        (150, "Unhealthy for Sensitive Groups"),
        (151, "Unhealthy"),
        (200, "Unhealthy"),
        (201, "Very Unhealthy"),
        (300, "Very Unhealthy"),
        (301, "Hazardous"),
        (480, "Hazardous"),
    ],
)
def test_category_boundaries(aqi, name):
    assert categorize(aqi) == name


def test_category_index_range():
    assert category_index(0) == 0 and category_index(500) == 5


def test_negative_aqi_rejected():
    with pytest.raises(ValueError, match="negative"):
        categorize(-1)


def test_dominant_pollutant_picks_highest_and_ignores_none():
    assert dominant_pollutant({"pm2_5": 80, "ozone": 120, "pm10": None}) == "ozone"


def test_dominant_pollutant_none_when_no_data():
    assert dominant_pollutant({"pm2_5": None}) is None
