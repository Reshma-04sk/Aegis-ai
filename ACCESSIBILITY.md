# Accessibility

**Target:** WCAG 2.1 AA on both pages, at desktop and phone sizes, with or without motion.

## Evidence

| Check | Where | Result |
|---|---|---|
| axe-core (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) on every page state: empty form, filled plan, landing page with live data, errors | `tests/e2e/app.spec.mjs`, run at **1440 px and 375 px** | 0 violations |
| Lighthouse accessibility, live site | `/` and `/plan`, mobile and desktop | **100 / 100** on all four runs |
| Keyboard-only flows (skip link, chips, FAQ, form, in-page links) | e2e tests | pass |
| `prefers-reduced-motion` honoured (bars drawn at full height at once, no smooth scrolling, no transitions) | e2e tests with emulated reduced motion | pass |
| No horizontal scroll at 375 px | e2e test measures `scrollWidth` | pass |

## How each requirement is met

**Perceivable**
- **Never colour alone.** Every AQI and verdict is shown as a number or word, plus a text label,
  plus an icon (`●`, `◆`, `▲`, `■`, `✖`, `☠`, `✔`, `⚠`, `⛔`). The icons are `aria-hidden`, so
  screen readers hear the words once (`dom.js` `badge()`).
- **Charts have a text twin.** The 24-hour bar chart is decorative (`aria-hidden`). The same
  values are in a real `<table>` with a caption and column scopes, inside a "Hourly values"
  disclosure (`cards/hourly.js` `hourlyTable()`).
- **Contrast.** Every text colour is at least 4.5:1 on its background. The EPA category colours
  are used as bright fills for chart bars, and in darkened versions for text (for example
  Unhealthy is `#a61f17` as text, `#e03131` as a bar).
- **Fonts.** Atkinson Hyperlegible Next, a typeface designed for low-vision readers, is used for
  body text.

**Operable**
- A skip link is the first focusable element and moves focus to `<main>`.
- Visible focus on every interactive element: a 3 px burnt-orange outline with an offset, which
  stands apart from the green actions and the EPA colours.
- Removing a household row moves focus to its neighbour or the add button, never to `<body>`.
- The scrollable commute table is a focusable, labelled region, so keyboard users can scroll it.
- **Motion.** The only animation is the hour bars growing once per city. Under
  `prefers-reduced-motion` they are drawn at full height and scrolling is instant.
- The system cursor is never replaced or hidden.

**Understandable**
- Every control has a `<label>`. Grouped choices use `<fieldset>` and `<legend>`.
- Only the location is required. An error sets `aria-invalid`, shows text next to the field,
  and moves focus there.
- Errors are announced with `role="alert"`, and the "forget household" confirmation with
  `role="status"`.
- Plain language throughout, with sentence-case labels and no jargon without explanation (for
  example "mixing layer" is explained in place).

**Robust**
- Semantic landmarks (`header`, `nav`, `main`, `section` with headings) and one `h1` per page.
- The results region is `aria-live` with `aria-busy` while loading. When a plan arrives it
  receives focus, so screen-reader users land on it.
- Each result card is a `<section>` labelled by its own heading (`aria-labelledby`).
- Animated headlines keep their full text as the accessible name: the word spans are
  `aria-hidden` and the heading has an `aria-label`.
