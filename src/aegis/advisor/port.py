"""The port every briefing writer implements: Gemini in production, rules as the fallback."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal, Protocol

if TYPE_CHECKING:
    from ..models import PlanResponse

type Source = Literal["gemini", "rules"]


class Advisor(Protocol):
    """Writes the plain-language briefing for a finished plan."""

    async def explain(self, plan: PlanResponse, note: str | None) -> tuple[str, Source]:
        """Return (briefing text, source); must never raise."""
        ...
