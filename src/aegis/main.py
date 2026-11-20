"""ASGI entry point for uvicorn: `uvicorn aegis.main:app`."""

from .api import create_app

app = create_app()
