// Count a number up to its value; instant when the user prefers reduced motion.

const COUNT_UP_MS = 900;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

/** Fast start, gentle stop: 1 - (1 - t)^3. */
const easeOutCubic = (/** @type {number} */ t) => 1 - (1 - t) * (1 - t) * (1 - t);

/**
 * Animate node's text from 0 to target.
 * @param {HTMLElement} node
 * @param {number} target
 */
export function countUp(node, target) {
  if (reduced.matches) {
    node.textContent = String(target);
    return;
  }
  const start = performance.now();
  /** @param {number} now */
  const step = (now) => {
    const t = Math.min(1, (now - start) / COUNT_UP_MS);
    node.textContent = String(Math.round(target * easeOutCubic(t)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
