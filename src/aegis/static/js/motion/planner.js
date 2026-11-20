// Planner page: motion answers what you do. Rows ease in, sections slide open, results rise in,
// the city gains depth as you scroll, and the sky settles to the plan's real AQI band.
import { EASE, OPEN, PLANNER } from "./constants.js";
import { finePointer } from "./env.js";
import { riseResults } from "./results.js";

/** @typedef {import("./env.js").Kit} Kit */

/**
 * The panel glides up (transform only, so text never shows at reduced contrast), and the city
 * layers rise at different speeds behind it as you scroll.
 * @param {Kit} kit
 * @param {HTMLElement} panel
 */
function backdrop({ gsap }, panel) {
  gsap.from(panel, { y: PLANNER.panelRise, duration: PLANNER.panelDuration, ease: EASE.enter });
  const timeline = gsap.timeline({
    defaults: { ease: EASE.scrub },
    scrollTrigger: { trigger: panel, start: "top top", end: "bottom bottom", scrub: PLANNER.parallaxScrub },
  });
  PLANNER.parallax.forEach(({ selector, y }) => timeline.to(selector, { y }, 0));
  timeline.to(".sun", { yPercent: PLANNER.sunSinkPercent }, 0);
}

/**
 * A soft glow follows the mouse across the glass: one fixed-size layer moved by transform, so
 * following the pointer never repaints the panel.
 * @param {HTMLElement} panel
 */
function pointerGlow(panel) {
  if (!finePointer.matches) return;
  panel.classList.add("has-glow");
  panel.addEventListener(
    "pointermove",
    (event) => {
      const box = panel.getBoundingClientRect();
      panel.style.setProperty("--mx", `${event.clientX - box.left}px`);
      panel.style.setProperty("--my", `${event.clientY - box.top}px`);
      panel.classList.add("is-lit");
    },
    { passive: true },
  );
  panel.addEventListener("pointerleave", () => panel.classList.remove("is-lit"));
}

/**
 * New household or plan rows ease open; restored rows appear with the panel, not one by one.
 * Removals stay instant so focus moves at once.
 * @param {Kit} kit
 */
function easeInRows({ gsap }) {
  const props = "height,transform,paddingTop,paddingBottom,overflow";
  /** @param {Node} row */
  const grow = (row) =>
    gsap.from(row, {
      height: 0,
      y: OPEN.rowDrop,
      paddingTop: 0,
      paddingBottom: 0,
      overflow: "hidden",
      duration: OPEN.rowDuration,
      ease: EASE.open,
      clearProps: props,
      overwrite: true,
    });
  ["members", "activities"].forEach((id) => {
    const list = /** @type {HTMLElement} */ (document.getElementById(id));
    let ready = false;
    new MutationObserver((changes) => {
      if (ready) {
        changes.forEach((c) => c.addedNodes.forEach((n) => n.nodeType === Node.ELEMENT_NODE && grow(n)));
      }
    }).observe(list, { childList: true });
    requestAnimationFrame(() => (ready = true));
  });
}

/**
 * Optional form sections slide open.
 * @param {Kit} kit
 * @param {HTMLElement} form
 */
function slideOpenSections({ gsap }, form) {
  form.querySelectorAll("details.section").forEach((node) => {
    const details = /** @type {HTMLDetailsElement} */ (node);
    details.addEventListener("toggle", () => {
      const body = details.open ? details.querySelector(".grid") : null;
      if (!body) return;
      gsap.from(body, {
        height: 0,
        y: OPEN.sectionDrop,
        overflow: "hidden",
        duration: OPEN.sectionDuration,
        ease: EASE.open,
        clearProps: "height,transform,overflow",
      });
    });
  });
}

/**
 * Start the planner motion when this is the planner page.
 * @param {Kit} kit
 */
export function startPlanner(kit) {
  const form = document.getElementById("plan-form");
  const results = document.getElementById("results");
  const panel = /** @type {HTMLElement | null} */ (document.querySelector(".planner > .glass"));
  if (!form || !results || !panel) return;
  backdrop(kit, panel);
  pointerGlow(panel);
  easeInRows(kit);
  slideOpenSections(kit, form);
  riseResults(kit, results);
}
