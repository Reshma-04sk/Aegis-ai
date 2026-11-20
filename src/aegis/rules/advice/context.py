"""What every advice rule may look at: one member, one activity, the current air."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ...models import Activity, AirSnapshot, Group, Verdict


@dataclass(frozen=True, slots=True)
class AdviceContext:
    """Inputs shared by the reason and action rules, computed once per member."""

    snapshot: AirSnapshot
    groups: list[Group]
    activity: Activity
    verdict: Verdict
    dominant: str | None
    hard_exercise: bool

    @property
    def sensitive(self) -> bool:
        """True when the member belongs to at least one sensitive group."""
        return bool(self.groups)


type AdviceRule = Callable[[AdviceContext], list[str]]
