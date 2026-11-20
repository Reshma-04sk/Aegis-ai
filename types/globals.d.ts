// Vendored libraries are loaded as classic <script> tags (src/aegis/static/vendor) and read from
// window; their types come from the same npm packages the files are copied from (`npm run vendor`).
import type { gsap as Gsap } from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import type LenisType from "lenis";

declare global {
  interface Window {
    gsap?: typeof Gsap;
    ScrollTrigger?: typeof ScrollTriggerType;
    Lenis?: typeof LenisType;
  }
}
