"""Errors raised when an upstream air-data service fails or a place cannot be found."""

UNAVAILABLE = "The air-quality forecast service did not respond. Please try again in a minute."


class AirDataError(Exception):
    """Upstream air-quality service failed or returned unusable data."""


class LocationNotFoundError(AirDataError):
    """The place name could not be geocoded."""
