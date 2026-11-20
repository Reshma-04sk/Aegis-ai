// The planner sky settles to the real AQI band of the plan: clear for Good, smog for Unhealthy+.
import { categoryIndex } from "../config.js";
import { EASE, SKY_SETTLE } from "./constants.js";
import { air } from "./env.js";

/** @typedef {import("./env.js").Kit} Kit */

/**
 * Animate the sky towards the haze level of an AQI value.
 * @param {Kit} kit
 * @param {number} aqi
 */
export function settleSky({ gsap }, aqi) {
  const level = Math.min(Math.max(categoryIndex(aqi), 0), SKY_SETTLE.maxBand) / SKY_SETTLE.maxBand;
  const tween = { duration: SKY_SETTLE.duration, ease: EASE.settle };
  gsap.to(".sky-clear", { ...tween, opacity: 1 - level * SKY_SETTLE.clearFade });
  gsap.to(".haze-1", { ...tween, opacity: level * SKY_SETTLE.haze1 });
  gsap.to(".haze-2", { ...tween, opacity: level * SKY_SETTLE.haze2, duration: SKY_SETTLE.slowHaze });
  gsap.to(".haze-3", {
    ...tween,
    opacity: SKY_SETTLE.haze3Base + level * SKY_SETTLE.haze3Range,
    duration: SKY_SETTLE.slowestHaze,
  });
  gsap.to(".sun", { ...tween, opacity: 1 - level * SKY_SETTLE.sunFade });
  gsap.to(air, { ...tween, density: level });
}
