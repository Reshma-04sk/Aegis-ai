"""Bounded-retry JSON GET shared by every upstream data client."""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from .errors import UNAVAILABLE, AirDataError

RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
RETRY_BACKOFF_SECONDS = 0.5
ATTEMPTS = 3


async def _fetch(
    http: httpx.AsyncClient, url: str, params: dict[str, Any], headers: dict[str, str] | None
) -> httpx.Response:
    """Try up to ATTEMPTS times; retry transport errors and 429/5xx, back off 0.5 s then 1 s."""
    for attempt in range(1, ATTEMPTS):
        try:
            response = await http.get(url, params=params, headers=headers)
        except httpx.TransportError:
            pass
        else:
            if response.status_code not in RETRY_STATUSES:
                return response
        await asyncio.sleep(RETRY_BACKOFF_SECONDS * attempt)
    return await http.get(url, params=params, headers=headers)


async def get_json(
    http: httpx.AsyncClient,
    url: str,
    params: dict[str, Any],
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """GET a JSON object; every failure becomes AirDataError. Each try uses the client timeout."""
    try:
        response = await _fetch(http, url, params, headers)
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise AirDataError(UNAVAILABLE) from exc
    if not isinstance(data, dict):
        raise AirDataError("unexpected response from air quality service")
    return data
