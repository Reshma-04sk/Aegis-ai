from fastapi import FastAPI


def test_entry_point_exposes_an_asgi_app(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from aegis.main import app

    assert isinstance(app, FastAPI)
