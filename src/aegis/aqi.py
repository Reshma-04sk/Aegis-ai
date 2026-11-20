"""US EPA AQI categories and pollutant helpers (pure functions).

Category ranges and descriptions: https://www.airnow.gov/aqi/aqi-basics/
"""

from __future__ import annotations

CATEGORIES: tuple[tuple[str, int], ...] = (
    ("Good", 50),
    ("Moderate", 100),
    ("Unhealthy for Sensitive Groups", 150),
    ("Unhealthy", 200),
    ("Very Unhealthy", 300),
)
HAZARDOUS = "Hazardous"

POLLUTANT_LABELS = {
    "pm2_5": "PM2.5",
    "pm10": "PM10",
    "nitrogen_dioxide": "NO₂",
    "ozone": "O₃",
    "sulphur_dioxide": "SO₂",
    "carbon_monoxide": "CO",
}


def category_index(aqi: float) -> int:
    """0 = Good … 5 = Hazardous."""
    if aqi < 0:
        raise ValueError("AQI cannot be negative")
    for index, (_, upper) in enumerate(CATEGORIES):
        if aqi <= upper:
            return index
    return len(CATEGORIES)


def categorize(aqi: float) -> str:
    """Return the EPA category name for an AQI value."""
    index = category_index(aqi)
    return CATEGORIES[index][0] if index < len(CATEGORIES) else HAZARDOUS


def dominant_pollutant(sub_indices: dict[str, float | None]) -> str | None:
    """Return the pollutant key with the highest sub-index, or None if no data."""
    known = {key: value for key, value in sub_indices.items() if value is not None}
    if not known:
        return None
    return max(known, key=lambda key: known[key])
