// Motion with GSAP, loaded on demand (its own chunk) and never when the visitor prefers reduced
// motion. React always renders the final state; animations only tween *from* a start value to
// it, so a reverted or interrupted animation can never leave a wrong number on screen.
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";

type Gsap = (typeof import("gsap"))["gsap"];
export interface Kit {
  gsap: Gsap;
  ScrollTrigger: typeof ScrollTriggerType;
}
/** Builds animations inside a GSAP context; may return a cleanup run when it is reverted. */
export type Build = (kit: Kit) => (() => void) | undefined;

export const EASE = "power3.out";
export const DURATION = 0.9;
export const STAGGER = 0.07;

/** True on the server and for visitors who asked the system for less motion. */
export const prefersReducedMotion = (): boolean =>
  typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let kit: Promise<Kit> | null = null;

/** GSAP and ScrollTrigger, fetched once and shared by every animation on the page. */
export function loadMotion(): Promise<Kit> {
  kit ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([core, scroll]) => {
    core.gsap.registerPlugin(scroll.ScrollTrigger);
    // Pure wall-clock timing: a throttled or background tab jumps to the final value on its next
    // frame instead of creeping through stale in-between numbers.
    core.gsap.ticker.lagSmoothing(0);
    return { gsap: core.gsap, ScrollTrigger: scroll.ScrollTrigger };
  });
  return kit;
}

/**
 * Run `build` in a GSAP context scoped to `scope`. Returns the cleanup for useEffect: it reverts
 * every tween and ScrollTrigger the build created, restoring the rendered (final) state.
 */
export function animate(scope: Element | null, build: Build): () => void {
  if (!scope || prefersReducedMotion()) return () => undefined;
  let live = true;
  let context: { revert: () => void } | null = null;
  void loadMotion().then((k) => {
    if (live) context = k.gsap.context(() => build(k), scope);
  });
  return () => {
    live = false;
    context?.revert();
  };
}

/** The text a counted number shows; shared by the render and the count-up so they agree. */
export const figureText = (value: number, digits: number): string =>
  value.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Count a number up from zero in `node`; the returned cleanup writes the final text back. */
export function countUp(
  k: Kit,
  node: Element,
  { target, digits }: { target: number; digits: number },
): () => void {
  const state = { value: 0 };
  k.gsap.to(state, {
    value: target,
    duration: DURATION,
    ease: EASE,
    onUpdate: () => {
      node.textContent = figureText(state.value, digits);
    },
  });
  return () => {
    node.textContent = figureText(target, digits);
  };
}
