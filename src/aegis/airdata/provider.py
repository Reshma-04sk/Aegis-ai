"""The port every air-quality source implements (Open-Meteo in production, fakes in tests)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from ..models import AirSnapshot


class AirDataProvider(Protocol):
    """Source of air-quality snapshots."""

    async def snapshot(
        self, *, location: str | None, latitude: float | None, longitude: float | None
    ) -> AirSnapshot:
        """Return a snapshot for a place name or coordinates."""
        ...
