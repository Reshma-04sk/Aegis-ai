# Security

## Reporting a vulnerability
Please open a private report through GitHub's "Report a vulnerability" (Security tab) instead of a
public issue. Expect a reply within 7 days.

## How AEGIS is protected
| Threat | Control | Where |
|---|---|---|
| Malformed or oversized input | Pydantic models with `extra="forbid"` and bounds on every field | `src/aegis/models/` |
| Prompt injection via the free-text note | Note passed to Gemini as delimited untrusted data; Gemini can only phrase the briefing, never change verdicts or numbers; output must be JSON, ≤ 700 chars, link-free | `src/aegis/advisor/gemini.py`, `advisor/briefing.py` |
| XSS | CSP with no inline scripts or styles; Trusted Types enforced (`require-trusted-types-for 'script'`, no policies allowed), so HTML-string sinks throw; DOM written only with `textContent` | `src/aegis/security.py`, `static/js/dom.js` |
| Clickjacking, sniffing, referrer leaks | `frame-ancestors 'none'` plus `X-Frame-Options: DENY`, COOP and CORP `same-origin`, COEP `require-corp` (cross-origin isolated), `nosniff`, `no-referrer`, HSTS, `Permissions-Policy` | `src/aegis/security.py` |
| Abuse / cost exhaustion | Per-client sliding-window rate limit, checked before body validation so malformed floods are counted; global Gemini calls-per-minute cap; bounded caches | `src/aegis/security.py`, `api/throttle.py`, `advisor/gemini.py`, `cache.py` |
| Rate-limit bypass via spoofed `X-Forwarded-For` | Header ignored unless `TRUSTED_PROXY_HOPS` is set, then only that many hops are trusted | `src/aegis/security.py` |
| Briefing replay | One-time, unguessable `briefing_id` (128-bit), expires after 5 minutes | `src/aegis/api/routes.py` |
| Upstream hangs | Bounded timeouts and at most 3 attempts on every outbound call | `src/aegis/api/app.py`, `fetch.py`, `advisor/gemini.py` |
| Secret leaks | Secrets only from environment variables; logs carry request IDs, never bodies or keys | `src/aegis/config.py`, `api/middleware.py` |
| Vulnerable dependencies | Exact locked versions; `pip-audit` + `npm audit` on every push | `.github/` |
| Container escape impact | Image runs as a non-root user | `Dockerfile` |
| Malicious or malformed upstream data | Provider JSON is narrowed field by field: non-numeric and boolean values become "missing" in forecasts; station readings also reject NaN, infinity and negatives, and a future timestamp makes the reading stale with an unknown age; a bad station payload can never fail a plan | `src/aegis/airdata/parse.py`, `stations/values.py`, `stations/openaq.py` |
| Selector or markup injection from saved data | Saved household values are `CSS.escape`d before use in selectors and only ever written with `textContent` | `static/js/household.js`, `storage.js`, `dom.js` |
| Privacy | No accounts, cookies or analytics; the household is kept in the browser's `localStorage` only; "Use my location" coordinates are rounded to 3 decimals (about 100 m) before they leave the device; every request is same-origin (`connect-src 'self'`) | `static/js/location.js`, `storage.js` |
| Insecure code patterns | ruff `S` (bandit) rules and CodeQL (`security-extended`) on Python and JavaScript, on every push and weekly | `pyproject.toml`, `.github/workflows/codeql.yml` |
| Runtime vulnerabilities | OWASP ZAP baseline scan against the running app in CI: 0 failures. Four reviewed warnings (comment words, intended no-cache, a font path that looks like base64, and fetch-metadata headers missing from the scanner's own requests) are recorded with reasons; anything new fails the build | `.github/workflows/ci.yml`, `.zap/rules.tsv` |
| Type confusion in input | Numeric fields are strict: JSON booleans and numeric strings are refused (found by API fuzzing) | `src/aegis/models/request.py` |

## Verified by tests
| Control | Test |
|---|---|
| Headers incl. Trusted Types, frame and CORP on page, asset and API routes | `tests/test_api.py::test_security_headers_and_request_id` |
| Prompt injection cannot change a verdict | `tests/test_api.py::test_prompt_injection_cannot_change_verdict` |
| Note sent to Gemini only as delimited untrusted data | `tests/test_advisor.py::test_gemini_success_sends_untrusted_note_delimited` |
| Rate limit, malformed floods, spoofed `X-Forwarded-For` | `tests/test_api.py::test_rate_limit_returns_429_with_retry_after`, `::test_malformed_requests_count_toward_the_limit`, `::test_spoofed_forwarded_for_cannot_bypass_limit` |
| Single-use briefings | `tests/test_api.py::test_briefing_is_single_use_and_passes_note` |
| Invalid input rejected with 422, including booleans and numeric strings | `tests/test_api.py::test_invalid_input_rejected` |
| No endpoint crashes or drifts from its contract under generated hostile input | `tests/test_api_fuzz.py` (Schemathesis) |
| Untrusted values and bounded resources hold for any input | `tests/test_properties.py` (Hypothesis) |
| Hostile upstream values stay missing | `tests/test_stations.py::test_non_finite_or_non_numeric_values_stay_missing`, `::test_malformed_payloads_never_fail_the_plan` |
| Limiter memory stays bounded | `tests/test_security.py::test_rate_limiter_hard_bound_when_all_active` |

Design rationale: [ADR 0001](docs/adr/0001-rules-decide-ai-explains.md) (AI cannot change
decisions) and [ADR 0004](docs/adr/0004-strict-csp-and-trusted-types.md) (CSP and Trusted Types).
