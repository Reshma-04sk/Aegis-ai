"""Action rules: each adds practical steps for one aspect of the situation, or nothing."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ...models import Group, Verdict

if TYPE_CHECKING:
    from .context import AdviceContext, AdviceRule

BASE_ACTIONS: dict[Verdict, list[str]] = {
    Verdict.GO: ["Air is fine for normal outdoor plans."],
    Verdict.CAUTION: [
        "Outdoor plans are fine; keep hard exercise shorter and take breaks.",
        "Go indoors if you notice coughing or throat irritation.",
    ],
    Verdict.LIMIT: [
        "Cut outdoor time and intensity, or move exercise indoors.",
        "If you go out, a well-fitted N95/FFP2 mask filters fine particles.",
    ],
    Verdict.AVOID: [
        "Stay indoors with windows closed and a purifier running if you have one.",
        "Skip outdoor exercise; if you must go out, wear a well-fitted N95/FFP2 mask.",
    ],
}
GROUP_ACTIONS: dict[Group, str] = {
    Group.ASTHMA: "Keep the reliever inhaler at hand and follow the asthma action plan.",
    Group.CHILD: "Keep outdoor play short and calm; watch for coughing.",
    Group.ELDERLY: "Avoid long outdoor stays and rest often.",
    Group.PREGNANT: "Limit time near traffic and avoid outdoor exertion.",
    Group.HEART: "Avoid outdoor exertion and contact a doctor if symptoms appear.",
}
POLLUTANT_ACTIONS: dict[str, str] = {
    "ozone": "Ozone peaks in afternoon sun; mornings and evenings are usually better.",
    "nitrogen_dioxide": "NO₂ comes mostly from traffic; choose quiet streets or parks.",
    "pm2_5": "Fine particles pass through cloth masks; an N95/FFP2 is the effective option.",
}
URGENT_HELP = (
    "For chest pain, severe breathlessness or wheezing, seek medical help or follow your "
    "local health authority's guidance."
)


def for_verdict(ctx: AdviceContext) -> list[str]:
    """The general steps for the verdict."""
    return list(BASE_ACTIONS[ctx.verdict])


def for_groups(ctx: AdviceContext) -> list[str]:
    """One step per sensitive group, once the air is not plainly fine."""
    return [] if ctx.verdict is Verdict.GO else [GROUP_ACTIONS[g] for g in ctx.groups]


def for_pollutant(ctx: AdviceContext) -> list[str]:
    """A step specific to the main pollutant, once the air is not plainly fine."""
    if ctx.verdict is Verdict.GO or ctx.dominant not in POLLUTANT_ACTIONS:
        return []
    return [POLLUTANT_ACTIONS[ctx.dominant]]


def urgent_help(ctx: AdviceContext) -> list[str]:
    """Where to turn for severe symptoms, at the verdicts where that matters. No diagnosis."""
    serious = ctx.verdict is Verdict.AVOID or (ctx.sensitive and ctx.verdict is Verdict.LIMIT)
    return [URGENT_HELP] if serious else []


ACTION_RULES: tuple[AdviceRule, ...] = (for_verdict, for_groups, for_pollutant, urgent_help)
