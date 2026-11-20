# Code quality

How the code is organised, the limits it is held to, and the check that enforces each one.
Every rule on this page fails CI when broken; none relies on review alone.

## Layers

```
Browser (React + TypeScript, web/src)          FastAPI (src/aegis)
  landing.tsx, planner.tsx  page entries        api/          app factory, routes, middleware, services, throttle
  prerender.tsx  server render for the build    service.py    build_plan(): assembles one plan from the engines
  lib/api.ts     the only network calls         rules/        verdicts, cleanest window, advice registries
  lib/format.ts  pure text and request helpers  planner/      schedule + personal dose per activity
  lib/geometry.ts  ring and bar geometry        indoor.py     purifier sizing, airing window
  lib/motion.ts  GSAP on demand, reduced-motion  commute/     emission factors (macro) and comparison
  lib/config.ts  constants generated from Python exposure.py  inhaled-dose formula (micro), shared
  lib/types.ts   the API contract               aqi.py        EPA breakpoints and categories
  components/    shell, badges, ring, strip     airdata/      Open-Meteo adapter, parser, provider port
  landing/       data hook, hero, tiles, story  stations/     OpenAQ adapter, pure helpers, provider port
  planner/       reducer, storage, form, cards  advisor/      Gemini adapter, rules briefing, facts, port
                                                models/       Pydantic v2 contract, split by domain
                                                frontend.py   constants and form choices for the UI
                                                fetch.py, cache.py, errors.py, freshness.py   shared infrastructure
```

Dependencies point inwards. The engines (`rules`, `planner`, `indoor`, `commute`, `exposure`,
`aqi`, `models`) never import the HTTP layer, an upstream adapter, `httpx` or `fastapi`.
`tests/test_conventions.py` resolves every import, including relative ones, and fails the build
if that changes.

## SOLID, with the files that apply each principle

| Principle | How it is applied | Files |
|---|---|---|
| Single responsibility | Every module does one job and its opening docstring or comment names it. Fetching, caching, parsing and adapting an upstream are separate files. | [airdata/](src/aegis/airdata/), [stations/](src/aegis/stations/), [api/](src/aegis/api/), [web/src/planner/cards/](web/src/planner/cards/) |
| Open/closed | Advice is built from ordered registries of small rule functions. A new reason or action is one function plus one registry entry, and `advise_member` does not change. A test runs a rule the registry has never seen. | [rules/advice/reasons.py](src/aegis/rules/advice/reasons.py), [rules/advice/actions.py](src/aegis/rules/advice/actions.py), [test_rules.py](tests/test_rules.py) |
| Liskov substitution | Production adapters and test fakes honour the same `Protocol`s. The e2e fixture and Schemathesis fuzzing run the real app on fakes. | [airdata/provider.py](src/aegis/airdata/provider.py), [stations/port.py](src/aegis/stations/port.py), [advisor/port.py](src/aegis/advisor/port.py), [e2e/fixture_app.py](tests/e2e/fixture_app.py) |
| Interface segregation | Each port has exactly one method: `snapshot`, `nearest` or `explain`. Nothing depends on a method it does not call. | the three ports above, [api/services.py](src/aegis/api/services.py) |
| Dependency inversion | Routes depend on the ports. `create_app(settings, Overrides(...))` wires real adapters or fakes in one place. | [api/app.py](src/aegis/api/app.py), [api/services.py](src/aegis/api/services.py) |

## Limits, and what enforces them

| Limit | Python | TypeScript (web/) |
|---|---|---|
| Module size | at most 110 lines (`test_conventions.py`); largest is 106 | logic (`.ts`) at most 110 code lines, components (`.tsx`) at most 150, since Prettier sets JSX one attribute per line (ESLint `max-lines`); largest is 141 |
| Function size | at most 30 lines (`test_conventions.py`); longest is 29 | logic at most 30 lines, components at most 60 (ESLint `max-lines-per-function`) |
| Cyclomatic complexity | at most 6 (ruff `C901`) | at most 6 (ESLint `complexity`) |
| Parameters | at most 5 (ruff `PLR0913`) | at most 3 (ESLint `max-params`) |
| Branches, statements, returns (JS: nesting) | 8 branches, 20 statements, 4 returns (ruff `PLR0912`, `PLR0915`, `PLR0911`) | depth 3 (ESLint `max-depth`) |
| Documentation | module docstring on every file (`test_conventions.py`); Google-style docstrings on every public API (ruff `D`) | an opening comment naming each file's job; a doc comment on every exported function and component |
| Types | `mypy --strict`; untrusted JSON is narrowed field by field at the parse boundary | `tsc --strict` with `noUncheckedIndexedAccess`; ESLint `strictTypeChecked`; saved device data is narrowed field by field |
| No debris | no `print`, no bare `except` (`test_conventions.py`); no commented-out code (ruff `ERA`) | `no-console`, `noUnusedLocals`, `noUnusedParameters` |
| Hooks | n/a | the React Hooks rules, including the compiler rules for refs, purity and state in effects (`eslint-plugin-react-hooks`) |

Ruff runs `E F W I B UP S SIM RUF C4 PT RET C90 PL N D FBT FURB PTH PERF TC ARG BLE DTZ T20 ERA`.
That includes Bandit security rules (`S`) and a ban on boolean positional flags (`FBT`).

## One source of truth
- **Numbers live in Python.** AQI breakpoints, category names, stale threshold and station radius
  reach the UI through `frontend.front_end_config()`, written to `web/src/generated/config.json`
  by `uv run aegis-config`. `test_frontend.py` fails if the file drifts; the front end never
  re-declares them.
- **The contract is Pydantic.** `models/` defines every request and response with
  `extra="forbid"`. `web/src/lib/types.ts` mirrors it and `tsc` checks every component against it
  ([ADR 0005](docs/adr/0005-prerendered-react-front-end.md)).
- **Rules decide, AI explains.** The model receives computed facts and returns text only
  ([ADR 0001](docs/adr/0001-rules-decide-ai-explains.md)).
- **Macro and micro impact never mix.** Emissions are computed in `commute/factors.py`. Personal
  dose is computed in `exposure.py`, and both commute and planner use it. They are separate
  fields in the API.

## Failure modes are explicit
- Upstream errors become `AirDataError` or `LocationNotFoundError` (`errors.py`), mapped to 502
  and 404 in `api/errors.py`.
- Every upstream call goes through `fetch.get_json`: at most 3 attempts, backoff of 0.5 s then
  1 s, and a client timeout on each try.
- Station lookup and the Gemini advisor never raise. They return a status or fall back to the
  rules briefing.

## Measured
- **Python:** 58 modules, 375 tests (unit, Hypothesis property, Schemathesis fuzz,
  conventions), 100% line coverage. ruff and `mypy --strict` are clean.
- **Front end:** 44 TypeScript modules, no third-party script hosts. ESLint (type-aware strict),
  `tsc` and Prettier are clean. 48 Vitest tests; 96% statement and 91% branch coverage.
- **End to end:** 32 Playwright tests at 1440 px and 375 px, including axe WCAG 2.1 AA.

## Reproduce
```bash
npm ci && npm run build && npm run lint && npm run typecheck && npm run format:check
npm run test:unit && npm run test:e2e
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest
```
