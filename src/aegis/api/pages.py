"""HTML routes: the two pages the front-end build writes (prerendered HTML, hydrated by React)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

# `npm run build` writes the pages and their hashed assets here (see vite.config.ts).
STATIC_DIR = Path(__file__).parent.parent / "static"

router = APIRouter(include_in_schema=False)


@router.get("/")
async def index() -> FileResponse:
    """Landing page."""
    return FileResponse(STATIC_DIR / "index.html")


@router.get("/plan")
async def planner() -> FileResponse:
    """Planner page."""
    return FileResponse(STATIC_DIR / "plan.html")
