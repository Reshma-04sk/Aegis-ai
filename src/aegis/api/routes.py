"""JSON API routes: health, the deterministic plan, and the single-use AI briefing."""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException

from ..advisor import rules_briefing
from ..models import Briefing, PlanRequest, PlanResponse
from ..service import build_plan
from .errors import BRIEFING_ERRORS, PLAN_ERRORS
from .services import ServicesDep
from .throttle import throttle

router = APIRouter(prefix="/api")


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}


@router.post("/plan", dependencies=[Depends(throttle)], responses=PLAN_ERRORS)
async def plan(body: PlanRequest, svc: ServicesDep) -> PlanResponse:
    """Deterministic plan, returned at once with a rule-based briefing."""
    snapshot = await svc.air.snapshot(
        location=body.location, latitude=body.latitude, longitude=body.longitude
    )
    station = await svc.stations.nearest(snapshot.latitude, snapshot.longitude)
    result = build_plan(snapshot, body, station)
    briefing_id = secrets.token_urlsafe(16)
    svc.pending.put(briefing_id, (result, body.note))
    return result.model_copy(
        update={"explanation": rules_briefing(result), "briefing_id": briefing_id}
    )


@router.post("/briefing/{briefing_id}", dependencies=[Depends(throttle)], responses=BRIEFING_ERRORS)
async def briefing(briefing_id: str, svc: ServicesDep) -> Briefing:
    """Single-use AI briefing for a plan created in the last few minutes."""
    entry = svc.pending.pop(briefing_id)
    if entry is None:
        raise HTTPException(404, "briefing expired, please plan again")
    result, note = entry
    text, source = await svc.advisor.explain(result, note)
    return Briefing(explanation=text, explanation_source=source)
