# ADR 0004: Strict CSP with Trusted Types

**Status:** accepted

## Context
The app shows text from third parties (place names from geocoding, station names from OpenAQ,
AI-written briefings) and from users (names, notes). Any of these could contain markup.

## Decision
- All DOM text is written with `textContent` through `dom.js`. No module uses `innerHTML` or
  similar sinks, and neither do the vendored libraries.
- CSP: `default-src 'self'`, no inline scripts or styles, `object-src 'none'`,
  `base-uri 'none'`, `frame-ancestors 'none'`, and `require-trusted-types-for 'script'` with
  `trusted-types 'none'`. Any future HTML-string sink therefore throws in the browser instead of
  becoming an XSS hole.
- Styles that animation needs are set through the CSSOM (`element.style`), which the CSP
  allows, never through `style` attributes.
- Supporting headers: HSTS, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, COOP and
  CORP `same-origin`, `X-Frame-Options: DENY`, and a minimal `Permissions-Policy` (geolocation
  self only).

## Consequences
- Some animation features that write style attributes (ScrollTrigger pinning) cannot be used,
  so sticky sections use CSS instead.
- `test_api.py::test_security_headers_and_request_id` asserts the policy on every route type.
