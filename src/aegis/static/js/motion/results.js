// Planner results: glide down to them, cards rise in turn, bars grow, and the sky settles.
import { EASE, RESULTS } from "./constants.js";
import { smoothScroller, topOffset } from "./scroll.js";
import { settleSky } from "./sky.js";

/** @typedef {import("./env.js").Kit} Kit */

/**
 * Cards rise in turn, then the chart bars grow. data-animating marks the short entrance so
 * tests can wait for it to settle.
 * @param {Kit} kit
 * @param {HTMLElement} results
 */
function entrance({ gsap }, results) {
  results.dataset.animating = "true";
  const cards = {
    y: RESULTS.cardRise,
    duration: RESULTS.cardDuration,
    ease: EASE.enter,
    stagger: RESULTS.cardStagger,
    clearProps: "transform",
  };
  const bars = {
    scaleY: 0,
    transformOrigin: "50% 100%",
    duration: RESULTS.barDuration,
    ease: EASE.open,
    stagger: RESULTS.barStagger,
  };
  gsap
    .timeline({ onComplete: () => delete results.dataset.animating })
    .from(results.children, cards, RESULTS.cardsAt)
    .from(results.querySelectorAll(".chart .bar"), bars, RESULTS.barsAt);
}

/**
 * Animate every new set of results announced by the planner.
 * @param {Kit} kit
 * @param {HTMLElement} results
 */
export function riseResults(kit, results) {
  document.addEventListener("aegis:results", (event) => {
    const lenis = smoothScroller();
    if (!lenis) return; // reduced motion was switched on mid-visit: results just appear
    lenis.resize(); // the results just grew the page
    kit.ScrollTrigger.refresh();
    lenis.scrollTo(results, { offset: topOffset(), duration: RESULTS.glide });
    entrance(kit, results);
    const aqi = /** @type {CustomEvent<{ aqi?: number }>} */ (event).detail?.aqi;
    if (typeof aqi === "number") settleSky(kit, aqi);
  });
}
