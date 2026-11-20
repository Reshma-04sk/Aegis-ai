# AEGIS – Urban Air Quality Assistant

[![CI](https://github.com/Cholan-kinnera/aegis-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Cholan-kinnera/aegis-ai/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Cholan-kinnera/aegis-ai/actions/workflows/codeql.yml/badge.svg)](https://github.com/Cholan-kinnera/aegis-ai/actions/workflows/codeql.yml)

**Live:** https://aegis-ai-6617.onrender.com · **Planner:** https://aegis-ai-6617.onrender.com/plan

> One AQI number tells nobody what to do. **AEGIS plans a household's day around the smog:**
> who in the family should go out and when, how to keep the air at home clean, and what a greener
> commute changes, with every number's source and age shown.

**Challenge:** PromptWars Virtual – Challenge 6, *Urban Air Quality Assistant*.

## At a glance

| Criterion | Evidence | Headline |
|---|---|---|
| Problem alignment | [PROBLEM_ALIGNMENT.md](PROBLEM_ALIGNMENT.md) | 16 requirements traced to code and tests |
| Code quality | [CODE_QUALITY.md](CODE_QUALITY.md) | Typed on both sides (mypy strict; TypeScript strict with type-aware ESLint), complexity ≤ 6, docstrings enforced |
| Security | [SECURITY.md](SECURITY.md) | Strict CSP with Trusted Types, prompt-injection-proof decisions, CodeQL |
| Efficiency | [EFFICIENCY.md](EFFICIENCY.md) | Prerendered pages, ~75 KB gzipped of shared script, animation code loaded only when motion is on; CLS ≤ 0.002 measured |
| Testing | [TESTING.md](TESTING.md) | 375 backend tests at **100% coverage** (incl. property-based, API fuzzing and code-convention checks), 48 front-end unit tests at 96% coverage, 32 browser tests, OWASP ZAP scan |
| Accessibility | [ACCESSIBILITY.md](ACCESSIBILITY.md) | WCAG 2.1 AA: zero axe violations at 1440 px and 375 px |

Design decisions: [docs/adr](docs/adr) (rules decide and AI explains; forecast and measurement
stay separate; a prerendered React front end; CSP with Trusted Types).

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
- **One service, no database.** React builds to static files that FastAPI serves, so there is
  one container and one set of security headers. Household details are kept only in the
  browser's localStorage and can be removed with "Forget saved household".

## Security
- Secrets only in environment variables (`.env.example` holds placeholders; `.env` is ignored).
- Pydantic validation with `extra="forbid"` and bounds on every field.
- Per-client rate limit. `X-Forwarded-For` is ignored unless `TRUSTED_PROXY_HOPS` is set, and then
  only that many hops are trusted, so set it to the real number of proxies in front of the app.
- CSP without inline scripts or styles, Trusted Types, `nosniff`, `no-referrer`,
  `frame-ancestors 'none'`, HSTS, `Permissions-Policy`, and `no-store` on API responses. React
  writes all text as text; there is no `dangerouslySetInnerHTML` anywhere.
- Structured logs with request IDs; user text and secrets are never logged.
- The container runs as a non-root user; CI has read-only permissions.

## Design
Two pages: a live landing page at `/` and the planner at `/plan` (`/plan?city=Delhi` prefills the
city). Both are React components prerendered to HTML at build time, so content paints before any
script runs; the landing page is then hydrated in place.

**The landing page** opens on a night sky that takes the colour of the chosen city's air:
- the sky's glow follows today's EPA category, and a slow haze of particles is drawn from the
  forecast PM2.5 (denser on dirtier days; decorative, paused off screen);
- the live instrument: an AQI ring on the EPA 0–500 scale with every category band in its own
  colour, the number at its centre, the category as text and icon, and the estimate's age;
- the next 24 hours as a strip of bars with the cleanest two hours bracketed and named, and a
  scrubber (a native range input) that reads out any hour as text, by keyboard or pointer;
- "Today in {city}": the call for a healthy adult, modelled PM2.5, the best mixing hour, the
  nearest monitor's measured PM2.5 with distance and age, and the way into the planner;
- then what a plan settles, how Aegis decides (a line that draws itself through Sense, Decide,
  Explain as you scroll), what the numbers are and are not, questions, and a closing call to act.

**The planner** puts the form beside the plan on wide screens and stacks them on phones. Result
cards reuse the ring and the scrubbable strip; the hourly values are also a table.

**Motion** uses GSAP with ScrollTrigger, loaded as a separate chunk only when the visitor has not
asked for reduced motion. React always renders the final values and GSAP only animates *from* a
start state, so an interrupted animation can never leave a wrong number on screen. With
`prefers-reduced-motion`, GSAP is never downloaded and everything appears in its final state.

The palette is warm paper (`#f4f1ea`) and night (`#0b1720`), ink `#14212b`, one pine green for
actions (`#0e6b5c`) and a mint accent on the night surfaces. Colour is otherwise reserved for the
air, using the EPA category colours, with darker variants for text on paper and lighter ones on
night so every label passes AA. Type is Fraunces, a variable serif, for headings and figures, and
Atkinson Hyperlegible Next, designed for low-vision readers, for reading. There are no
third-party scripts or font hosts: the fonts are bundled from npm at the exact versions in
`package-lock.json` and served from our own origin.

| Asset | Package | License |
|---|---|---|
| Fraunces, Atkinson Hyperlegible Next (latin, variable) | @fontsource-variable 5.3.0 | SIL Open Font License 1.1 |
| GSAP and ScrollTrigger | gsap 3.15.1 | GSAP Standard "no charge" license (gsap.com/standard-license) |

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
| `src/aegis/frontend.py` | Constants and form choices for the UI, written to `web/src/generated/config.json` by `uv run aegis-config` |
| `web/src/lib/` | API contract types, config, pure formatting, chart geometry, network calls, motion |
| `web/src/components/` | Shared pieces: page shell, badges, AQI ring, counted figures, the 24-hour strip |
| `web/src/landing/` | Landing page: city data hook, hero, instrument, haze, glance tiles, story sections |
| `web/src/planner/` | Planner: form state (one reducer), device storage, form sections, results and cards |
| `web/prerender.ts`, `vite.config.ts` | The build: client bundle, server render, and each page filled with its HTML |

## Checks
```bash
uv sync
uv run ruff check . && uv run ruff format --check .
uv run mypy            # strict
npm ci && npm run build   # the page tests serve the built front end
uv run pytest             # 375 tests incl. property, fuzz and convention tests, 100% coverage
npm run lint && npm run typecheck && npm run format:check
npm run test:unit         # 48 Vitest tests with coverage
npx playwright install chromium
npx playwright test       # 32 browser tests at 1440px and 375px, incl. axe WCAG 2.1 AA scans
```
The browser tests run the real front end and API against fixed air data
(`tests/e2e/fixture_app.py`), so they need no network or API key. They check the landing page (live data, the keyboard scrubber, scroll reveals, reduced motion), the whole flow,
number + text + icon for the AQI, data-age labels, the separate CO2e and inhaled-dose figures,
alerts for errors, keyboard access, reduced motion, no horizontal scroll, no console or CSP
errors, and zero axe violations before and after a plan is shown.

CI runs all of the above plus `pip-audit`, `npm audit`, CodeQL and an OWASP ZAP scan on every push. See [SECURITY.md](SECURITY.md) for the threat model.

## Run locally
```bash
cp .env.example .env    # optional: GEMINI_API_KEY (else rule-based briefing),
                        # OPENAQ_API_KEY (else no station card)
npm ci && npm run build   # build the front end into src/aegis/static
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
             models/ · aqi.py · config.py · frontend.py · main.py (ASGI entry) · static/ (built)
web/         React + TypeScript front end (src/, the two page shells, prerender.ts)
tests/       pytest suite · tests/web (Vitest) · tests/e2e (Playwright)
```

## Limits
- CAMS is a regional forecast model, not a street-level sensor.
- Emission factors are UK averages; local fleets and power grids differ.
- Indoor numbers assume a well-mixed, closed room and are estimates, not measurements.
- The rate limiter and cache live in each process; several instances would need a shared store.
- Guidance is general and **not medical advice**.
