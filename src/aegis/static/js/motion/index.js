// Motion for both pages. One idea carries it: the air over the city. With prefers-reduced-motion
// nothing here animates: the sky is still and scrolling is native.
// No ScrollTrigger pinning: it writes style attributes, which the CSP blocks.
import { air, motionKit, reducedMotion } from "./env.js";
import { revealHeadlines } from "./headline.js";
import { startLanding } from "./landing.js";
import { startParticles } from "./particles.js";
import { startPlanner } from "./planner.js";
import { startSmoothScroll, stopSmoothScroll, wireScrollLinks } from "./scroll.js";

/** @typedef {import("./env.js").Kit} Kit */

const root = document.documentElement;

/**
 * Finish every animation at its end state and stop all motion (reduced motion turned on).
 * @param {Kit} kit
 * @param {Array<() => void>} stoppers
 */
function stopAll(kit, stoppers) {
  kit.ScrollTrigger.getAll().forEach((trigger) => {
    trigger.animation?.progress(1);
    trigger.kill();
  });
  kit.gsap.globalTimeline.getChildren().forEach((animation) => animation.progress(1));
  stopSmoothScroll(kit);
  stoppers.forEach((stop) => stop());
  air.density = 0;
  document.querySelectorAll(".phase").forEach((phase) => phase.classList.add("is-active"));
  root.classList.add("sky-is-clear");
}

/** Start everything that moves, and stop it all if the user asks for reduced motion. */
function start() {
  wireScrollLinks();
  const kit = motionKit();
  if (!kit) {
    root.classList.add("sky-is-clear");
    return;
  }
  /** @type {Array<() => void>} */
  const stoppers = [];
  startSmoothScroll(kit);
  revealHeadlines(kit);
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.querySelector(".particles"));
  if (canvas) stoppers.push(startParticles(kit, canvas));
  if (document.querySelector(".hero")) startLanding(kit);
  startPlanner(kit);
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches) stopAll(kit, stoppers);
  });
}

start();
