"""In-memory TTL cache with a size bound; the oldest entry is evicted first."""

from __future__ import annotations

import time

MAX_CACHE_ENTRIES = 256


class TTLCache[T]:
    """Tiny bounded cache keyed by string."""

    def __init__(self, ttl_seconds: int, max_entries: int = MAX_CACHE_ENTRIES) -> None:
        self._ttl = ttl_seconds
        self._max = max_entries
        self._items: dict[str, tuple[float, T]] = {}

    def get(self, key: str) -> T | None:
        """Return the live value for key, evicting it if expired."""
        entry = self._items.get(key)
        if entry is None:
            return None
        if time.monotonic() - entry[0] > self._ttl:
            del self._items[key]
            return None
        return entry[1]

    def pop(self, key: str) -> T | None:
        """Return and remove the live value for key (single use)."""
        value = self.get(key)
        self._items.pop(key, None)
        return value

    def put(self, key: str, value: T) -> None:
        """Store value under key, evicting the oldest entry when full."""
        if key not in self._items and len(self._items) >= self._max:
            self._items.pop(next(iter(self._items)))
        self._items[key] = (time.monotonic(), value)
