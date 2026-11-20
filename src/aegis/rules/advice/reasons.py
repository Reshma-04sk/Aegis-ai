"""Reason rules: each explains one input behind the verdict, or says nothing."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ...aqi import POLLUTANT_LABELS, categorize
from ...models import Group

if TYPE_CHECKING:
    from .context import AdviceContext, AdviceRule

GROUP_LABELS = {
    Group.ASTHMA: "asthma or a lung condition",
    Group.CHILD: "a child",
    Group.ELDERLY: "an older adult",
    Group.PREGNANT: "pregnancy",
    Group.HEART: "a heart condition",
}


def current_aqi(ctx: AdviceContext) -> list[str]:
    """The AQI and its EPA category."""
    aqi = ctx.snapshot.aqi
    return [f"US AQI is {round(aqi)} ({categorize(aqi)})."]


def main_pollutant(ctx: AdviceContext) -> list[str]:
    """Which pollutant drives the AQI, when one is known."""
    if not ctx.dominant:
        return []
    return [f"{POLLUTANT_LABELS.get(ctx.dominant, ctx.dominant)} is the main pollutant."]


def sensitive_groups(ctx: AdviceContext) -> list[str]:
    """Why the stricter sensitive-group ladder applies."""
    if not ctx.sensitive:
        return []
    return [f"Sensitive-group guidance applies ({', '.join(GROUP_LABELS[g] for g in ctx.groups)})."]


def hard_exercise(ctx: AdviceContext) -> list[str]:
    """Why hard exercise moved the verdict one step stricter."""
    if not ctx.hard_exercise:
        return []
    return [f"{ctx.activity.value.capitalize()} means breathing much more air per minute."]


REASON_RULES: tuple[AdviceRule, ...] = (
    current_aqi,
    main_pollutant,
    sensitive_groups,
    hard_exercise,
)
