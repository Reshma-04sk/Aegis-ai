// Smooth scrolling (Lenis, driven by GSAP's ticker) and in-page links that move focus too.
import { SCROLL } from "./constants.js";

/** @typedef {import("./env.js").Kit} Kit */
/** @typedef {import("./env.js").Lenis} Lenis */

/** @type {Lenis | null} */
let lenis = null;
/** @type {(time: number) => void} */
const tick = (time) => lenis?.raf(time * 1000);

/** Distance to leave above a scrolled-to section, so the sticky top bar never covers it. */
export function topOffset() {
  const topbar = /** @type {HTMLElement | null} */ (document.querySelector(".topbar"));
  return -((topbar?.offsetHeight ?? 0) + SCROLL.belowTopbar);
}

/** The running smooth scroller, or null when scrolling is native. */
export const smoothScroller = () => lenis;

/**
 * Start smooth scrolling and keep ScrollTrigger in step with it.
 * @param {Kit} kit
 */
export function startSmoothScroll({ gsap, ScrollTrigger, Lenis }) {
  lenis = new Lenis({ autoRaf: false, lerp: SCROLL.lerp });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
}

/**
 * Stop smooth scrolling (reduced motion switched on mid-visit).
 * @param {Kit} kit
 */
export function stopSmoothScroll({ gsap }) {
  gsap.ticker.remove(tick);
  lenis?.destroy();
  lenis = null;
}

/**
 * A plain left click; modified clicks (new tab, new window) are left to the browser.
 * @param {MouseEvent} event
 */
const isPlainClick = (event) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

/**
 * Follow an in-page link: scroll to the target and move keyboard focus there.
 * @param {MouseEvent} event
 */
function followLink(event) {
  if (!isPlainClick(event)) return;
  const hash = /** @type {HTMLAnchorElement} */ (event.currentTarget).getAttribute("href") ?? "";
  const target = /** @type {HTMLElement | null} */ (document.querySelector(hash));
  if (!target) return;
  event.preventDefault();
  if (window.location.hash !== hash) history.pushState(null, "", hash);
  if (lenis) {
    lenis.scrollTo(target, { offset: topOffset() });
    target.focus({ preventScroll: true });
  } else {
    target.focus();
    target.scrollIntoView({ block: "start" });
  }
}

/** Wire every `a[data-scroll]` link; works with or without smooth scrolling. */
export function wireScrollLinks() {
  document
    .querySelectorAll("a[data-scroll]")
    .forEach((link) => link.addEventListener("click", (e) => followLink(/** @type {MouseEvent} */ (e))));
}
