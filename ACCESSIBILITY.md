# Accessibility

**Target:** WCAG 2.1 AA on both pages, at desktop and phone sizes, with or without motion.

## Evidence

| Check | Where | Result |
|---|---|---|
| axe-core (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) on every page state: empty form, filled plan, landing page with live data, errors | `tests/e2e/app.spec.mjs`, run at **1440 px and 375 px** | 0 violations |
| Lighthouse accessibility, live site (previous front end; to re-run after deploying the rebuild) | `/` and `/plan`, mobile and desktop | **100 / 100** on all four runs |
| Keyboard-only flows (skip link, city buttons, hour scrubber, FAQ, form, in-page links) | e2e and component tests | pass |
| `prefers-reduced-motion` honoured (no animation code is downloaded or created; ring, numbers, bars and sections appear in their final state) | e2e tests with emulated reduced motion | pass |
| No horizontal scroll at 375 px | e2e test measures `scrollWidth` | pass |

## How each requirement is met

**Perceivable**
- **Never colour alone.** Every AQI and verdict is shown as a number or word, plus a text label,
  plus an icon (`●`, `◆`, `▲`, `■`, `✖`, `☠`, `✔`, `⚠`, `⛔`). The icons are `aria-hidden`, so
  screen readers hear the words once (`components/Badge.tsx`).
- **Charts have a text twin.** The 24-hour bar strip is decorative (`aria-hidden`). Its scrubber
  is a native range input whose `aria-valuetext` and visible readout give each hour as words
  ("09:00: US AQI 95 (Moderate), PM2.5 52.3 µg/m³, forecast"), and in the planner the same
  values are in a real `<table>` with a caption and column scopes (`planner/cards/Schedule.tsx`).
  The ring and the haze are decorative too; the number and category are always text beside them.
- **Contrast.** Every text colour is at least 4.5:1 on its background, placeholders included
  (5.5:1); form-control borders are 4.1:1. The EPA category colours are bright fills for bars and
  the ring, with darker versions for text on paper (Unhealthy `#a61f17`, 6.6:1) and lighter ones
  on the night surfaces (Unhealthy `#ff8a80`, 6.6:1 on `#12283a`); the lowest text pair is 4.9:1.
  Focus rings are 4.5:1 on paper and 10.7:1 on night.
- **Fonts.** Atkinson Hyperlegible Next, a typeface designed for low-vision readers, is used for
  body text.

**Operable**
- A skip link is the first focusable element and moves focus to `<main>`.
- Visible focus on every interactive element: a 3 px burnt-orange outline with an offset, which
  stands apart from the green actions and the EPA colours.
- Removing a household row moves focus to its neighbour or the add button, never to `<body>`.
- The scrollable commute table is a focusable, labelled region, so keyboard users can scroll it.
- **Motion.** The ring sweep, count-ups, growing bars and section reveals run once per data
  load or first view; the haze drifts slowly and pauses off screen. Under
  `prefers-reduced-motion` GSAP is never downloaded, no animation is created, the haze is drawn
  once and still, and scrolling is instant.
- **Live updates.** Switching city updates one polite status line ("Delhi: US AQI 209, Very
  Unhealthy."), so screen-reader users hear the result once instead of every tile changing.
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
- Headlines are never split or animated, so their text is their accessible name.
- Both pages are prerendered HTML: headings, the form and every section exist before any script
  runs.
