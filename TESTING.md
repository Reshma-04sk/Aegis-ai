# Testing

Every push runs all of the suites below in CI (`.github/workflows/ci.yml`). Nothing calls the
real network in tests: HTTP is mocked with `respx`, and the browser suite runs against fixed air
data (`tests/e2e/fixture_app.py`).

## Results

| Suite | Tool | Tests | Result |
|---|---|---|---|
| Backend unit, integration and API | pytest 9, respx, FastAPI TestClient | **371** | all pass, **100% line coverage** (CI fails under 90%) |
| Property-based | Hypothesis | 10 properties × 300 generated cases | all hold (included in the 371) |
| API fuzzing | Schemathesis, from the OpenAPI schema | 3 endpoints × 150 generated requests | no 5xx, no undocumented status, no schema drift, invalid input always rejected (included in the 371) |
| Dynamic security scan | OWASP ZAP baseline against the running app | 70 passive rules | 0 failures, 66 passes; 4 reviewed warnings recorded with reasons in `.zap/rules.tsv`; its COEP finding was fixed |
| Front-end helpers | `node:test` | **6** | all pass |
| End-to-end in a real browser | Playwright (Chromium) + axe-core | **28** (14 scenarios × desktop 1440 px and mobile 375 px) | all pass, zero WCAG 2.1 AA violations |
| Static checks | ruff, mypy `--strict`, ESLint 10, tsc `--checkJs` strict, Prettier | n/a | zero findings |
| Security scanning | CodeQL (Python and JavaScript), pip-audit, npm audit | n/a | in CI |

### Backend tests by module

| File | Tests | What it proves |
|---|---|---|
| `test_aqi.py` | 16 | EPA category boundaries at every breakpoint, negative AQI rejected, dominant pollutant ignores missing values |
| `test_rules.py` | 24 | Full verdict matrix (category × sensitivity × exercise); cleanest-window search across midnight, with missing hours and taken slots |
| `test_planner.py` | 7 | Distinct slots per activity, sensitive members tighten the schedule, PM2.5 dose for "chosen slot vs now" follows activity intensity |
| `test_indoor.py` | 6 | Purifier sizing matches the EPA chart; undersized purifiers flagged; airing window |
| `test_commute.py` | 5 | Emissions avoided are consistent; carpooling divides only the vehicle factor; exposure can rise while emissions fall |
| `test_profiles.py` | 8 | Groups and activities from free text, including negation ("no asthma") |
| `test_airdata.py` | 16 | Parsing keeps missing values missing; data age and staleness; cache keys; bounded retries (3 tries) and no retry on 4xx |
| `test_stations.py` | 28 | Nearest station; NaN, infinity, booleans and negative values stay missing; future timestamps are not "fresh"; malformed payloads never fail a plan |
| `test_advisor.py` | 21 | Gemini sees only computed facts; the user note is delimited as untrusted; failures fall back to the rule briefing; budget and retry limits |
| `test_api.py` | 32 | Security headers (CSP with Trusted Types, frame and CORP), gzip, request ids; validation; **prompt injection cannot change a verdict**; rate limits (including malformed floods and spoofed `X-Forwarded-For`); single-use briefings |
| `test_security.py` | 9 | Rate limiter recovers, prunes idle clients and stays bounded under load; proxy-aware client IP |
| `test_properties.py` | 10 | Invariants over generated input: worse air is never a looser verdict; sensitive people and hard exercise are never treated more loosely; the household follows its strictest member; the cleanest window equals an independent brute-force minimum and respects its limits; station values are always finite and non-negative or missing; any 300-character note parses; distance is a metric; caches and the rate limiter never exceed their bounds |
| `test_api_fuzz.py` | 3 | Schemathesis sends generated valid, boundary and malformed requests to every endpoint |
| `test_conventions.py` | 182 | Every module at most 110 lines with a docstring, every function at most 30 lines, no `print` or bare `except`, and the decision engines never import the HTTP layer or an upstream adapter (imports resolved, relative ones included) |
| `test_templating.py` | 3 | The page config the front end reads comes from the Python constants |
| `test_main.py` | 1 | The ASGI entry point builds the app |

### What fuzzing found and fixed
- **Booleans and numeric strings were coerced into numbers.** `{"purifier_cadr_m3h": false}` was
  accepted as 0. Every numeric request field is now strict, and 4 regression cases in
  `test_api.py::test_invalid_input_rejected` pin it down.
- **Undocumented error responses.** The OpenAPI schema now declares the 400, 404, 429 and 502
  responses the endpoints really return.

### Browser scenarios (each runs at 1440 px and 375 px)

**Planner (`/plan`)**
- Loads without layout shift (CLS under 0.05; the pre-fix page measured 0.074 and fails).
- Empty form meets WCAG 2.1 AA and has no horizontal scroll.
- A full household plan shows verdicts, provenance with data age, schedule, indoor and commute
  cards, and passes axe again with results on screen.
- An unknown place is announced as an alert.
- Keyboard: the skip link is first and moves focus to the main content.
- Reduced motion disables animations.
- Before a plan, the results column says what to do; adding a person adds a row.
- A city chosen on the landing page prefills the planner.

**Landing page (`/`)**
- Loads without layout shift: fonts swap into metric-matched fallbacks.
- The hero and every section pass WCAG 2.1 AA with live data shown.
- City chips switch the live forecast and announce which city is pressed.
- The hero instrument brackets the cleanest two hours and names them.
- Calls to action open the planner and the method section.
- FAQ answers open from the keyboard.
- Reduced motion draws the hour bars at full height at once.

## How the tests are designed
- **Edge cases first.** Boundary AQI values, empty or missing hours, midnight wrap-around,
  non-finite numbers, malformed upstream JSON, future timestamps, duplicate sensors.
- **Behaviour, not implementation.** API tests go through HTTP. Browser tests use roles and
  labels (`getByRole`, `getByLabel`), which is how assistive technology finds things too.
- **Regression tests for bugs fixed.** For example: station distances recomputed for every caller
  (`test_stations.py`), malformed floods counted by the rate limiter, and the layout-shift test
  that fails on the old page.
- **Deterministic.** Fixed clocks and mocked HTTP. Browser state is awaited with polling assertions;
  the one fixed wait (800 ms) is deliberate, checking that nothing animates under reduced motion.

## Run locally
```bash
uv sync && npm ci && npx playwright install chromium
uv run pytest                 # 371 tests (incl. property, fuzz and convention tests) + coverage report
node --test tests/js/         # 6 helper tests
npx playwright test           # 28 browser tests (starts the fixture server itself)
uv run ruff check . && uv run mypy && npm run lint && npm run typecheck && npm run format:check
```
