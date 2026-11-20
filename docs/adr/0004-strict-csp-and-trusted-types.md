# ADR 0004: Strict CSP with Trusted Types

**Status:** accepted

## Context
The app shows text from third parties (place names from geocoding, station names from OpenAQ,
AI-written briefings) and from users (names, notes). Any of these could contain markup.

## Decision
- All data is rendered as text by React (see [ADR 0005](0005-prerendered-react-front-end.md)).
  No component uses `dangerouslySetInnerHTML` or another HTML-string sink, and neither do the
  bundled libraries on the paths we use (the browser tests fail on any CSP or Trusted Types
  error in the console).
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
- Markup `style` attributes are blocked, so all styling lives in stylesheets and the prerendered
  HTML never contains one. GSAP sets styles through the CSSOM, which the policy allows.
- `test_api.py::test_security_headers_and_request_id` asserts the policy on every route type.
