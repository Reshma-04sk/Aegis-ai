"""Per-member advice, assembled from ordered registries of small reason and action rules.

Adding advice means adding one rule function and one registry entry; the assembler below
does not change (open/closed). Callers may pass their own registries, as the tests do.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ...aqi import dominant_pollutant
from ...models import MemberAdvice
from ..verdict import HARD_EXERCISE, verdict_for
from .actions import ACTION_RULES
from .context import AdviceContext, AdviceRule
from .reasons import REASON_RULES

if TYPE_CHECKING:
    from collections.abc import Sequence

    from ...models import Activity, AirSnapshot, Member

__all__ = ["ACTION_RULES", "REASON_RULES", "AdviceContext", "AdviceRule", "advise_member"]


def _context(snapshot: AirSnapshot, member: Member, activity: Activity) -> AdviceContext:
    """Compute the shared inputs once: groups, verdict and main pollutant."""
    groups = sorted(set(member.groups))
    hard = activity in HARD_EXERCISE
    return AdviceContext(
        snapshot=snapshot,
        groups=groups,
        activity=activity,
        verdict=verdict_for(snapshot.aqi, sensitive=bool(groups), hard_exercise=hard),
        dominant=dominant_pollutant(snapshot.sub_indices),
        hard_exercise=hard,
    )


def advise_member(
    snapshot: AirSnapshot,
    member: Member,
    activity: Activity,
    rules: tuple[Sequence[AdviceRule], Sequence[AdviceRule]] = (REASON_RULES, ACTION_RULES),
) -> MemberAdvice:
    """Verdict, reasons and actions for one member at the current AQI."""
    ctx = _context(snapshot, member, activity)
    reasons, actions = ([line for rule in group for line in rule(ctx)] for group in rules)
    return MemberAdvice(
        name=member.name, groups=ctx.groups, verdict=ctx.verdict, reasons=reasons, actions=actions
    )
