"""Air-quality data: the provider port, the Open-Meteo adapter and its payload parser."""

from .openmeteo import OpenMeteoClient
from .parse import parse_air_response, parse_weather
from .provider import AirDataProvider

__all__ = [
    "AirDataProvider",
    "OpenMeteoClient",
    "parse_air_response",
    "parse_weather",
]
