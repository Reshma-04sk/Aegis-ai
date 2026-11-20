"""HTML routes: the landing page and the planner, rendered from Jinja templates."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from ..templating import TEMPLATES, page_context

router = APIRouter(include_in_schema=False)


@router.get("/")
async def index(request: Request) -> HTMLResponse:
    """Landing page."""
    return TEMPLATES.TemplateResponse(request, "index.html", page_context())


@router.get("/plan")
async def planner(request: Request) -> HTMLResponse:
    """Planner page."""
    return TEMPLATES.TemplateResponse(request, "plan.html", page_context())
