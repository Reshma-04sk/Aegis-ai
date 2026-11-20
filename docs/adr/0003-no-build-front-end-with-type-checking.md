# ADR 0003: A no-build front end, still type-checked

**Status:** superseded by [ADR 0005](0005-prerendered-react-front-end.md)

## Context
The UI is two pages with one form and one results view. A framework and bundler would add
hundreds of dependencies, a build step and a larger attack surface for little benefit. But
untyped JavaScript drifts from the API contract.

## Decision
- Plain ES modules served directly by FastAPI. There is no bundler and no runtime framework.
  There are no third-party scripts; the two fonts are vendored and same-origin, so the CSP
  stays `script-src 'self'`.
- Types without a build: `types/api.d.ts` mirrors `models/`, and every module is checked
  with `tsc --checkJs --strict` through JSDoc. ESLint and Prettier run in CI.
- Modules have single responsibilities: `dom.js` (safe builders), `household.js` and `rows.js`
  (form rows), `storage.js` (device storage), `api.js` (network), `cards/` (one result card each),
  `app.js` (wiring).

## Consequences
- The browser runs exactly the files that were type-checked and tested.
- Total page weight is about 245 KiB, mostly fonts and the vendored animation library.
- A new API field must be added to `api.d.ts`, or the front end fails type-checking.
