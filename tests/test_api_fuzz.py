"""API fuzzing: Schemathesis generates requests from the app's own OpenAPI schema.

Valid, boundary and deliberately malformed bodies, paths and headers are sent through the real
ASGI app (with fixed air data, so nothing touches the network). Every response must:
never be a 5xx, use a documented status code, match the documented response schema and content
type, and reject invalid input instead of accepting it.
"""

from __future__ import annotations

import schemathesis
from e2e.fixture_app import FixtureAir, FixtureStations
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, settings
from schemathesis.specs.openapi.checks import positive_data_acceptance

from aegis.api import Overrides, create_app
from aegis.config import Settings

# No Gemini key: the advisor uses the rule briefing and never calls out.
APP = create_app(
    Settings(rate_limit_per_minute=1_000_000),
    Overrides(air=FixtureAir(), stations=FixtureStations()),
)
schema = schemathesis.openapi.from_asgi("/openapi.json", APP)


@schema.parametrize()
@settings(max_examples=150, deadline=None, suppress_health_check=list(HealthCheck))
def test_api_holds_its_contract_under_generated_input(case: schemathesis.Case) -> None:
    with TestClient(APP) as client:  # runs the lifespan, as uvicorn does
        response = case.call(session=client)
    # Excluded: "schema-valid request rejected". Cross-field rules (latitude needs longitude; the
    # time range must fit the activity) cannot be expressed in OpenAPI, so a 422 there is correct.
    case.validate_response(response, excluded_checks=[positive_data_acceptance])
