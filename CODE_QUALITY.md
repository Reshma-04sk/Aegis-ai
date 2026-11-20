# Code quality

## Architecture

```
Browser (no build step)                       FastAPI (src/aegis)
  app.js ── wiring, events                      api.py ──── router, typed Services, throttle dependency, headers
  household.js ── form rows, local storage      service.py ─ build_plan(): assembles one plan
  render.js ── result cards (pure builders)     rules.py, planner.py, indoor.py, commute.py ── deterministic decisions
  dom.js ── safe DOM builders (textContent)     aqi.py, profiles.py ── EPA categories, note parsing
  format.js ── pure helpers (unit-tested)       airdata.py, stations.py ── upstream clients (Open-Meteo, OpenAQ)
  live.js, motion.js, cursor.js ── landing       advisor.py ── Gemini briefing with a rules fallback
  api.d.ts ── API contract types                models.py ── Pydantic v2 API contract (extra="forbid")
```

**Layer rules**
- Decisions (`rules`, `planner`, `indoor`, `commute`) are pure functions with no I/O, so they
  are tested without mocks.
- I/O lives only in `airdata`, `stations` and `advisor`, behind small Protocols
  (`AirDataProvider`, `StationProvider`, `Advisor`). Tests and the e2e fixture inject fakes
  through `create_app()`.
- The AI layer receives computed facts and returns text. It cannot reach the decision layer
  ([ADR 0001](docs/adr/0001-rules-decide-ai-explains.md)).
- On the front end, only `app.js` talks to the network; `render.js` turns data into DOM; and
  only `dom.js` creates elements (always via `textContent`).

## Typed contracts on both sides
- `models.py`: Pydantic v2 models with `extra="forbid"`, bounded strings and lists, and
  cross-field validation (for example, latitude and longitude must come together).
- `static/js/api.d.ts` mirrors those models one-to-one. `tsc --checkJs` in **strict** mode
  checks every front-end module against them through JSDoc
  ([ADR 0003](docs/adr/0003-no-build-front-end-with-type-checking.md)).
- `mypy --strict` on all application code (`src/`). Untrusted JSON enters as `dict[str, Any]` only
  at the parsing boundary and is narrowed field by field into typed models before it goes further.

## Enforced gates (CI fails on any finding)

| Gate | Configuration |
|---|---|
| ruff lint | `E F W I B UP S SIM RUF C4 PT RET C90 PL N D FBT FURB PTH PERF TC ARG BLE DTZ T20 ERA`: includes security (`S`), cyclomatic complexity ≤ 10 (`C90`), pylint, Google-style docstrings on every public API (`D`), no boolean positional flags (`FBT`) |
| ruff format | Line length 100 |
| mypy | `--strict` |
| ESLint 10 | Recommended rules plus `eqeqeq`, `no-shadow`, `no-param-reassign`, `no-eval`, complexity ≤ 12, max depth 4, functions ≤ 60 lines |
| TypeScript 7 | `--checkJs --strict --noUnusedLocals --noUnusedParameters` over the whole front end |
| Prettier | JavaScript, TypeScript declarations, JSON and YAML |
| pytest | Coverage gate at 90% (actual: 100%), including Hypothesis property tests and Schemathesis API fuzzing |
| OWASP ZAP | Baseline scan of the running app; fails on any unreviewed alert |
| CodeQL | `security-extended` and `security-and-quality` queries for Python and JavaScript |

The static gates (ruff, mypy, ESLint, tsc, Prettier) also run locally through `.pre-commit-config.yaml`. `.editorconfig` and
`.gitattributes` keep line endings and whitespace consistent.

## Conventions
- **Small units.** Backend functions stay under complexity 10. Front-end modules each have one
  job (`dom`, `household`, `render`, `app`).
- **No dead code or TODOs.** The `ERA` rule rejects commented-out code.
- **Explicit failure modes.** Upstream errors become typed `AirDataError` and
  `LocationNotFoundError`, mapped to 502 and 404. Station lookup never raises and returns a
  status instead. The AI advisor never raises and falls back to rules.
- **Constants are named and documented where they come from**, such as EPA breakpoints, DESNZ
  factors, inhalation rates and `STALE_AFTER_MINUTES = 180`.
- **Conventional commits**, one logical change per commit.
- **Dependencies pinned exactly.** `uv.lock` (exported and audited by `pip-audit --require-hashes` in CI)
  and `package-lock.json`, audited on every push (`pip-audit`, `npm audit`). Dependabot update pull requests are paused
  during judging so `main` stays the only branch.

## Reproduce
```bash
uv run ruff check . && uv run ruff format --check . && uv run mypy
npm run lint && npm run typecheck && npm run format:check
```
