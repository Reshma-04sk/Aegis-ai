# AEGIS – Urban Air Quality Assistant

[![CI](https://github.com/Cholan-kinnera/aegis-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Cholan-kinnera/aegis-ai/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Cholan-kinnera/aegis-ai/actions/workflows/codeql.yml/badge.svg)](https://github.com/Cholan-kinnera/aegis-ai/actions/workflows/codeql.yml)

**Live:** https://aegis-ai-5fgm.onrender.com · **Planner:** https://aegis-ai-5fgm.onrender.com/plan

> One AQI number tells nobody what to do. **AEGIS plans a household's day around the smog:**
> who in the family should go out and when, how to keep the air at home clean, and what a greener
> commute changes, with every number's source and age shown.

**Challenge:** PromptWars Virtual – Challenge 6, *Urban Air Quality Assistant*.

## At a glance

| Criterion | Evidence | Headline |
|---|---|---|
| Problem alignment | [PROBLEM_ALIGNMENT.md](PROBLEM_ALIGNMENT.md) | 16 requirements traced to code and tests |
| Code quality | [CODE_QUALITY.md](CODE_QUALITY.md) | Typed on both sides (mypy strict, tsc strict `--checkJs`), complexity ≤ 10, docstrings enforced |
| Security | [SECURITY.md](SECURITY.md) | Strict CSP with Trusted Types, prompt-injection-proof decisions, CodeQL |
| Efficiency | [EFFICIENCY.md](EFFICIENCY.md) | Lighthouse **100** for performance, accessibility, best practices and SEO on both pages, mobile and desktop; CLS 0 |
| Testing | [TESTING.md](TESTING.md) | 371 backend tests at **100% coverage** (incl. property-based, API fuzzing and code-convention checks), 28 browser tests, OWASP ZAP scan |
| Accessibility | [ACCESSIBILITY.md](ACCESSIBILITY.md) | WCAG 2.1 AA: zero axe violations at 1440 px and 375 px |

Design decisions: [docs/adr](docs/adr) (rules decide and AI explains; forecast and measurement
stay separate; no-build typed front end; CSP with Trusted Types).

## Who it is for
Families in smog-affected cities, especially households with someone sensitive: asthma or a lung
condition, children, older adults, pregnancy or a heart condition. One person's details are enough;
up to eight members can be added, and the household gets the strictest member's verdict.

## What it does
| Problem-statement need | How AEGIS answers it |
|---|---|
| Health guidance for sensitive groups | A verdict per member (**Go / Take care / Limit / Stay indoors**) from the EPA AQI category descriptions; sensitive groups are treated one category stricter, and hard exercise one step stricter again. |
| Low-emission daily routine | Each planned activity is placed in its cleanest forecast hours within the member's own time limits, and the impact of that choice is shown as PM2.5 breathed in during the chosen slot versus going now (EPA inhalation rates for the activity's intensity). If the air is bad all day, the app says so and suggests doing it indoors. |
| Indoor air | Purifier sizing (EPA chart), clean-air changes per hour, time to cut particles by 90%, the best hour to air the home, and smog-season habits. |
| Greener commute | kg CO2e per week for each travel mode (UK DESNZ 2026 factors), **kept separate from** the PM2.5 you breathe in per trip (EPA Exposure Factors Handbook). On a smoggy day cycling cuts emissions but raises your exposure, and the app shows both. |
| Personal, plain-language briefing | Google Gemini (`gemini-3.5-flash-lite`) writes a short briefing from the computed plan. The page shows a rule-based briefing at once and replaces it when Gemini answers. |

## How it works
Full request/response reference: [docs/api.md](docs/api.md).

```
Browser ──▶ POST /api/plan ──▶ Open-Meteo geocoding + CAMS air quality + weather (TTL cache)
                           ──▶ OpenAQ nearest station, latest measurements (TTL cache, optional)
                           ──▶ rules/ · planner/ · indoor.py · commute/ (deterministic)
                           ◀── plan + rule-based briefing + one-time briefing_id
        ──▶ POST /api/briefing/{id} ──▶ Gemini rewrites the briefing (never the numbers)
```

## Data honesty
- Two kinds of data, never mixed:
  - **Model estimate**: the Copernicus CAMS forecast via Open-Meteo. It covers every location and
    drives the hourly planning.
  - **Station observation**: the nearest monitoring station that reported in the last 24 hours,
    within 25 km, via [OpenAQ](https://openaq.org) (which carries government networks such as
    India's CPCB). It is shown in its own card with station id, provider, distance, the provider's
    own units, unconverted, and the provider's attribution. Readings silent for over a day are
    left out. It never replaces
    or adjusts a model value.
- Every value shows its source, observation time, retrieval time and data age. Data older than
  3 hours is flagged as stale.
- Missing values stay missing; nothing is filled in or invented.
- Emissions (macro impact) and inhaled dose (personal exposure) are separate fields and labels.
- No medical claims: guidance points to the person's doctor and local health authority.

## Design decisions
- **The LLM never decides.** Verdicts, schedules and numbers are deterministic and unit-tested.
  Gemini only phrases the briefing. Its output must be JSON of at most 700 characters with no links,
  or it is discarded. The user's note is passed as delimited, untrusted data.
- **Fast first paint.** The plan returns without waiting for Gemini, which can take 5–25 s.
  Gemini calls have a 25 s overall budget (one retry on 429/5xx inside it) and a global
  per-minute cap.
- **No build step, no database.** FastAPI serves one static page. Household details are kept only
  in the browser's localStorage and can be removed with "Forget saved household".

## Security
- Secrets only in environment variables (`.env.example` holds placeholders; `.env` is ignored).
- Pydantic validation with `extra="forbid"` and bounds on every field.
- Per-client rate limit. `X-Forwarded-For` is ignored unless `TRUSTED_PROXY_HOPS` is set, and then
  only that many hops are trusted, so set it to the real number of proxies in front of the app.
- CSP without inline scripts, `nosniff`, `no-referrer`, `frame-ancestors 'none'`, HSTS,
  `Permissions-Policy`, and `no-store` on API responses. The DOM is written only with
  `textContent`.
- Structured logs with request IDs; user text and secrets are never logged.
- The container runs as a non-root user; CI has read-only permissions.

## Design
Two pages: a live dashboard at `/` and the planner at `/plan` (`/plan?city=Delhi` prefills the city).

**The dashboard** shows one city's air as a bento grid of tiles, switched with a city selector:
- an AQI dial on the EPA 0-500 scale, every category band in its own colour, the value arc sweeping
  to today's number while the number counts up;
- the next 24 hours as bars that grow in, with the cleanest two hours bracketed and named;
- today's call for a healthy adult, its first action and the reasons behind it;
- modelled PM2.5 and the pollutant driving the AQI;
- the hour the air layer mixes deepest, when smog spreads out most;
- the nearest official monitor's measured PM2.5, with its distance and age;
- a link to plan a day for your own household in that city.

Every tile reserves its loaded height, so live data never moves the page, and a shimmer shows
while a city loads. Below the grid: what a plan covers, how Aegis decides (sense, decide,
explain), what the numbers are and are not, and questions.

**The planner** puts the form beside the plan on wide screens (the form stays in view while you
read) and stacks them on phones. The overview card carries the same dial; result cards rise in
turn.

**Motion** uses the browser's Web Animations API, with no library: the dial sweep, count-ups,
tiles rising in turn and bars growing, each once per data load. With `prefers-reduced-motion`
everything appears in its final state and no animation is created.

The palette is white tiles on cool mineral (`#e6edef`), slate ink (`#1b2b3a`), one shield green
for actions (`#0e6b5c`) and an amber rule for the cleanest window (`#c98a1b`). Colour is otherwise
reserved for the air itself, using the EPA category colours, darkened for text so every label
passes AA. Type is Fraunces, a variable serif, for headings and figures, and Atkinson Hyperlegible
Next, a face designed for low-vision readers, for reading. There are no third-party scripts. The
two fonts are not committed: `npm run vendor` (and the Docker build) copies them from npm, at the
exact versions in `package-lock.json`, into `src/aegis/static/vendor`, so they are served from our
own origin.

| Asset | Package | License |
|---|---|---|
| Fraunces, Atkinson Hyperlegible Next (latin, variable) | @fontsource-variable 5.3.0 | SIL Open Font License 1.1 |

## Accessibility
Skip link, landmarks and headings; every control is labelled; fieldsets for grouped choices;
verdicts and AQI shown as number + text + icon, never colour alone; an `aria-live` results region
that receives focus; the forecast is also available as a data table; visible focus;
`prefers-reduced-motion` respected; fully keyboard operable; no horizontal scroll at 375 px.

## Code layout
| Path | Role |
|---|---|
| `src/aegis/api/` | App factory, JSON and page routes, middleware, service container, throttle |
| `src/aegis/airdata/`, `stations/` | Open-Meteo (CAMS) and OpenAQ adapters, their parsers and provider ports |
| `src/aegis/fetch.py`, `cache.py`, `errors.py` | Bounded-retry JSON GET, TTL cache, typed upstream errors |
| `src/aegis/rules/`, `planner/`, `indoor.py`, `commute/`, `exposure.py` | Deterministic decisions: verdicts, cleanest windows, dose, CADR, emissions |
| `src/aegis/advisor/` | Gemini briefing, grounded on plan facts, with a rules fallback |
| `src/aegis/models/` | Pydantic v2 API contract, split by domain |
| `static/js/format.js` | Pure helpers (unit-tested with `node:test`) |
| `types/api.d.ts`, `types/globals.d.ts` | API contract types mirroring `models/`; checked by `tsc --checkJs` |
| `static/js/dom.js` | Safe DOM builders (`textContent` only) shared by both pages |
| `static/js/app.js`, `api.js`, `results.js`, `cards/` | Planner wiring, network calls, results region, one module per card |
| `static/js/household.js`, `rows.js`, `storage.js`, `location.js` | Form rows, device storage, place or coordinates |
| `static/js/dashboard.js`, `tiles/`, `gauge.js`, `motion.js` | Landing dashboard, its tiles, the AQI dial and native animation helpers |

## Checks
```bash
uv sync
uv run ruff check . && uv run ruff format --check .
uv run mypy            # strict
uv run pytest          # 371 tests incl. property, fuzz and convention tests, 100% coverage
node --test tests/js/  # front-end helpers
npm ci && npm run vendor && npm run lint && npm run typecheck && npm run format:check
npx playwright install chromium
npx playwright test    # 28 browser tests at 1440px and 375px, incl. axe WCAG 2.1 AA scans
```
The browser tests run the real front end and API against fixed air data
(`tests/e2e/fixture_app.py`), so they need no network or API key. They check the landing page (focus moves with in-page links, reduced motion), the whole flow,
number + text + icon for the AQI, data-age labels, the separate CO2e and inhaled-dose figures,
alerts for errors, keyboard access, reduced motion, no horizontal scroll, and zero axe violations
before and after a plan is shown.

CI runs all of the above plus `pip-audit`, `npm audit`, CodeQL and an OWASP ZAP scan on every push. See [SECURITY.md](SECURITY.md) for the threat model.

## Run locally
```bash
cp .env.example .env    # optional: GEMINI_API_KEY (else rule-based briefing),
                        # OPENAQ_API_KEY (else no station card)
npm ci --omit=dev && npm run vendor   # fetch the two fonts from npm
uv run --env-file .env uvicorn aegis.main:app --reload
# open http://localhost:8000
```

## Deploy
**Render (free):** New → Blueprint → pick this repo. `render.yaml` defines the service; paste
`GEMINI_API_KEY` when Render asks for it.

**Google Cloud Run:**
```bash
gcloud run deploy aegis-ai --source . --region asia-south1 --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest --set-env-vars TRUSTED_PROXY_HOPS=1
```
`TRUSTED_PROXY_HOPS=1` matches Cloud Run's single front proxy. Leave it at 0 when nothing sits in
front of the app.

## Project layout
```
src/aegis/  api/ (routes, middleware) · service.py (orchestration) · rules/ (verdicts, advice)
             planner/ (routine, dose) · indoor.py · commute/ · exposure.py · airdata/ (Open-Meteo)
             stations/ (OpenAQ) · advisor/ (Gemini + fallback) · profiles.py · security.py
             models/ · aqi.py · config.py · main.py (ASGI entry) · static/ (CSS, JS) · templates/
tests/       pytest suite + tests/js (node:test)
```

## Limits
- CAMS is a regional forecast model, not a street-level sensor.
- Emission factors are UK averages; local fleets and power grids differ.
- Indoor numbers assume a well-mixed, closed room and are estimates, not measurements.
- The rate limiter and cache live in each process; several instances would need a shared store.
- Guidance is general and **not medical advice**.
