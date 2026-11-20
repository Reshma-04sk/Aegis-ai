# Efficiency

Server figures were measured on the **live deployment** (Render free tier, Singapore), from a
client in India, on 20 Nov 2026. Front-end figures are from the local production build.

## Front end after the React rebuild (local build, measured)

| Asset (gzipped) | Landing `/` | Planner `/plan` | Notes |
|---|---|---|---|
| Shared script (React, React DOM, shared code) | 73.4 KB | 73.4 KB | cached once for both pages |
| Page script | 5.4 KB | 7.8 KB | |
| CSS | 2.2 + 3.3 KB | 2.2 + 2.6 KB | |
| Fonts (woff2, latin, variable) | 70.6 KB | 70.6 KB | display face preloaded |
| GSAP + ScrollTrigger (lazy chunks) | 27.3 + 17.4 KB | 27.3 + 17.4 KB | only fetched when motion is allowed; never for reduced motion |

| Measure | Landing 1440 px | Landing 375 px | Planner 1440 px | Planner 375 px |
|---|---|---|---|---|
| Cumulative Layout Shift (fresh browser, fixture data) | 0.0019 | 0.0002 | 0 | 0.0004 |

## Lighthouse 13.6 (live site, via PageSpeed Insights, 21 Nov 2026)

| Page | Device | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|---|
| `/` | Mobile | **99** | **100** | **100** | **100** | 0.8 s | 0.8 s | 0 ms | 0 |
| `/` | Desktop | **100** | **100** | **100** | **100** | 0.2 s | 0.2 s | 20 ms | 0.002 |
| `/plan` | Mobile | **100** | **100** | **100** | **100** | 0.8 s | 0.8 s | 0 ms | 0 |
| `/plan` | Desktop | **100** | **100** | **100** | **100** | 0.2 s | 0.2 s | 0 ms | 0 |

Agentic Browsing passes 2/2 on every run. Mobile runs use Lighthouse's emulated Moto G Power on
slow 4G. Reports:
[landing](https://pagespeed.web.dev/analysis/https-aegis-ai-6617-onrender-com/tjomqwlk8l) ·
[planner](https://pagespeed.web.dev/analysis/https-aegis-ai-6617-onrender-com-plan/l6buq8111g).

The first audit of the rebuilt site found **CLS 0.063 on the desktop landing page**: with live
data the geocoded place name and the full model name wrapped to more lines than the loading
state, so the instrument grew 27 px. Reserving that space fixed it (0.063 → 0.002, and
Performance 98 → 100).

### What keeps it fast
- **Prerendered pages.** Both pages are rendered to HTML at build time, so the headline, form and
  sections paint before any script runs; the largest content never waits for React.
- **Layout shift stays near zero.**
  - Metric-matched fallback fonts. Atkinson averages 0.441 em per character, the same as Arial.
    Fraunces at weight 700 averages 115.7% of Liberation Serif Bold (metric-compatible with
    Times New Roman Bold). Measured from the font files with fontTools.
  - The display font is preloaded (a small Vite plugin adds the hashed file) and set to
    `font-display: optional`, so a late arrival never re-wraps a headline.
  - Live data fills space reserved for it: the instrument's footer and the AQI number have fixed
    sizes, and the planner's checkbox chips sit in a fixed grid, so the web font arriving never
    re-wraps them.
  - Browser tests fail if CLS goes above 0.05.
- **Animation code only when wanted.** GSAP and ScrollTrigger are separate chunks loaded after
  first paint, and never for reduced-motion visitors.
- **Compression.** `GZipMiddleware` for responses over 1 KB.
- **Caching.** Hashed build assets that exist are `public, max-age=31536000, immutable` (a 404 is never cached); pages are
  `no-cache` plus ETag, so a deploy is never served stale. API responses are `no-store`.

## Server-side caching (live, `curl`)

| Request | First (cache miss) | Repeat (cache hit) |
|---|---|---|
| `POST /api/plan` Lucknow | 4.66 s | 0.31 s, then 0.20 s |
| `POST /api/plan` Patna | 3.73 s | 0.18 s |
| `GET /api/health` | n/a | 0.09–0.19 s |

The miss time is dominated by the upstream calls (geocoding, CAMS air quality, weather and the
OpenAQ station lookup). A hit is network round trip only, about **95% faster**.

- `airdata.TTLCache`: forecasts are cached for 600 s and geocoding for 3,600 s, each bounded to 256 entries with
  oldest-first eviction. Forecasts are keyed to 0.01° of latitude and longitude, so nearby
  requests share them, while user-facing labels are never shared between requests.
- The OpenAQ client caches raw station rows and recomputes distance and data age for each
  caller, so a cached answer is never stale about its own age.
- Briefing hand-off uses a single-use, 300 s TTL cache, so a plan is never computed twice to get
  its AI briefing.

## Bounded work on every path
| Concern | Bound |
|---|---|
| Upstream HTTP | 8 s timeout per try (4 s connect), at most 3 tries, retry only on network errors and 429/5xx, backoff 0.5 s then 1 s |
| Gemini | 25 s overall budget including one retry; global calls-per-minute cap; replies capped at 400 tokens and 700 characters |
| Abuse | 30 requests per minute per client (sliding window, at most 10,000 tracked clients), counted before body validation |
| Request size | Pydantic limits: at most 8 members, 6 activities, a 300-character note, 100-character place names |

## Front-end runtime
- **One request per city, briefly.** The landing page reuses a city's plan for five minutes, so
  switching back is instant, then fetches it again so the shown data age is never frozen; a
  newer choice always wins over a slower earlier one.
- **Bounded idle work.** The hero's haze is one canvas of at most 220 particles; it pauses when
  scrolled out of view, the browser pauses it in background tabs, and with reduced motion it is
  drawn once and never animated. There are no scroll listeners of our own; ScrollTrigger reveals
  each section once and stops.
- **Compositor-friendly motion.** Animations change only `transform`, `opacity` and the ring's
  `stroke-dashoffset`; count-ups update one text node per frame for under a second, and use
  wall-clock time so a throttled tab jumps straight to the final value.
- **Reduced motion** downloads no animation code, creates no animations and makes scrolling
  instant.

## Reproduce
```bash
npm ci && npm run build
npx lighthouse@13.6.0 https://aegis-ai-6617.onrender.com/plan --preset=desktop
curl -s -o /dev/null -w "%{time_total}\n" -X POST https://aegis-ai-6617.onrender.com/api/plan \
  -H 'Content-Type: application/json' -d '{"location":"Lucknow"}'
```
