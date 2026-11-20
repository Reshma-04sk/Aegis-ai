# Efficiency

All figures below were measured on the **live deployment** (Render free tier, Singapore),
from a client in India, on 20 Nov 2026.

## Lighthouse 13.6 (live site)

| Page | Device | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Weight |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Mobile | **100** | **100** | **100** | **100** | 0.9 s | 0.9 s | 0 ms | 0 | 242 KiB |
| `/` | Desktop | **100** | **100** | **100** | **100** | 0.4 s | 0.4 s | 0 ms | 0 | 242 KiB |
| `/plan` | Mobile | **100** | **100** | **100** | **100** | 1.0 s | 1.0 s | 0 ms | 0 | 245 KiB |
| `/plan` | Desktop | **100** | **100** | **100** | **100** | 0.4 s | 0.4 s | 0 ms | 0 | 245 KiB |

Lighthouse's Agentic Browsing category also scores 100 on all four runs.

### What got it there
- **Layout shift went from 0.347 to 0.** The first live audit found CLS 0.347 (planner, mobile)
  and 0.159 (landing, desktop). Fixes:
  - Metric-matched fallback fonts. Atkinson averages 0.441 em per character, the same as Arial.
    Fraunces at weight 700 averages 115.7% of Liberation Serif Bold (metric-compatible with
    Times New Roman Bold). Measured from the font files with fontTools.
  - The display font is preloaded and set to `font-display: optional`, so a late arrival never
    re-wraps a headline.
  - The planner module runs with `blocking="render"` and `modulepreload`, so saved form rows
    exist before the first paint.
  - Browser tests now fail if CLS goes above 0.05.
- **No build, no framework, no third-party scripts.** Plain ES modules (about 17 KB of app
  JavaScript in total, gzipped), served same-origin. Motion uses the browser's built-in Web
  Animations API, so no animation library is downloaded.
- **Compression.** `GZipMiddleware` for responses over 1 KB. HTML is 10.8 KB raw and 3.7 KB on
  the wire; CSS is 22.4 KB raw and 6.0 KB; a full plan's JSON is 4.6 KB raw and 1.5 KB.
- **Caching.** Static files are sent with `Cache-Control: no-cache` plus ETag, so they are
  revalidated cheaply and a deploy is never served stale. API responses are `no-store`.

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
- **One request per city.** The dashboard fetches a city once per page view and keeps it, so
  switching back is instant; a newer choice cancels the effect of a slower earlier one.
- **No idle work.** No canvas, no scroll listeners, no backdrop blur. Animations run once per
  data load and stop.
- **Compositor-friendly motion.** Animations change only `transform`, `opacity` and the dial's
  `stroke-dashoffset`; count-ups update one text node per frame for under a second.
- **Reduced motion** creates no animations at all and makes scrolling instant.

## Reproduce
```bash
npx lighthouse@13.6.0 https://aegis-ai-5fgm.onrender.com/plan --preset=desktop
curl -s -o /dev/null -w "%{time_total}\n" -X POST https://aegis-ai-5fgm.onrender.com/api/plan \
  -H 'Content-Type: application/json' -d '{"location":"Lucknow"}'
```
