# ADR 0005: A prerendered React front end, served by FastAPI

**Status:** accepted (supersedes [ADR 0003](0003-no-build-front-end-with-type-checking.md))

## Context
The landing page became a live instrument (a category-tinted sky, a haze drawn from PM2.5, an
AQI ring, a scrubbable 24-hour strip, scroll-drawn sections), and the planner shares several of
its pieces. Building that from hand-written DOM code meant one-off builders for every widget
and state kept in the DOM. We still want what ADR 0003 protected: one service, a strict CSP
with Trusted Types, typed against the API contract, fast first paint, no third-party hosts.

## Decision
- **React 19 + TypeScript (strict), built by Vite 8** from `web/` into `src/aegis/static`.
  FastAPI serves the two built pages and their hashed assets; there is still one container and
  one set of security headers.
- **Prerendered.** `vite build --ssr` renders both pages to HTML at build time
  (`web/prerender.ts`), so content paints before any script runs. The landing page is hydrated
  in place. The planner renders over its prerendered HTML instead, because its first state comes
  from this device's saved household, which a build cannot know.
- **Constants still live in Python.** `uv run aegis-config` writes
  `web/src/generated/config.json` from `aegis/frontend.py`; a pytest test fails if they drift.
- **CSP unchanged.** No inline scripts or styles: the prerendered HTML carries no `style`
  attributes (dynamic geometry is SVG attributes; animation writes styles through the CSSOM,
  which CSP allows), and nothing uses `dangerouslySetInnerHTML`, so Trusted Types stays at
  `'none'`.
- **Motion with GSAP, on demand.** GSAP and ScrollTrigger are lazy chunks, never fetched for
  reduced-motion visitors. React renders final values and GSAP only tweens *from* a start, so an
  interrupted animation cannot leave a wrong number visible. `@gsap/react` is not used, because
  its `useGSAP` imports GSAP up front; a small `animate()` helper gives the same scoped cleanup.
- **Held to the same limits.** Type-aware ESLint (`strictTypeChecked`, React Hooks rules),
  complexity 6, three parameters; logic files at most 30 lines per function, components at
  most 60 because Prettier sets JSX one attribute per line. Vitest + Testing Library for units
  and components, the existing Playwright + axe suite end to end.

## Consequences
- A build step: `npm ci && npm run build` before running the app or the page tests (CI and the
  Dockerfile do this; the runtime image is still Python only).
- Heavier first load than ADR 0003's pages: about 73 KB gzipped of shared React code, cached
  across both pages, plus 27 + 17 KB of GSAP only when motion is on.
- A new API field must be added to `web/src/lib/types.ts`, or the front end fails type-checking.
