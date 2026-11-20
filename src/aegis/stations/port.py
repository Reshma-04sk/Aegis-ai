"""The port every station source implements (OpenAQ in production, fakes in tests)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from .openaq import StationLookup


class StationProvider(Protocol):
    """Finds the nearest monitoring station; must never raise."""

    async def nearest(self, latitude: float, longitude: float) -> StationLookup:
        """Return the nearest station observation and a status."""
        ...
