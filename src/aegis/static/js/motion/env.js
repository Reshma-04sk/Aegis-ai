// What the motion layer may rely on: the user's preferences and the animation libraries, which
// load as deferred classic scripts before any module runs.

/** @typedef {typeof import("gsap").gsap} Gsap */
/** @typedef {typeof import("gsap/ScrollTrigger").ScrollTrigger} ScrollTriggerApi */
/** @typedef {import("lenis").default} Lenis */
/** @typedef {{ gsap: Gsap, ScrollTrigger: ScrollTriggerApi, Lenis: typeof import("lenis").default }} Kit */

export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
export const finePointer = window.matchMedia("(pointer: fine) and (hover: hover)");

/**
 * The animation libraries, or null when motion should not run (reduced motion, or a library
 * failed to load). Nothing else reads them from `window`.
 * @returns {Kit | null}
 */
export function motionKit() {
  const { gsap, ScrollTrigger, Lenis } = window;
  if (reducedMotion.matches || !gsap || !ScrollTrigger || !Lenis) return null;
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger, Lenis };
}

/** Shared, animatable state: 0 is a clear sky, 1 is thick smog. */
export const air = { density: 0 };
