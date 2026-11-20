// Motion with the browser's own Web Animations API (no library). Every effect checks the
// reduced-motion preference first and, when it is set, shows the end state at once.

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const RISE_PX = 14;
const RISE_MS = 520;
const STAGGER_MS = 70;
const COUNT_MS = 900;
const SWEEP_MS = 1100;
const EASE_POWER = 3; // cubic ease-out
const BAR_STAGGER_MS = 25;

/**
 * Elements fade up into place one after another.
 * @param {Iterable<Element>} nodes
 */
export function rise(nodes) {
  if (reduced.matches) return;
  [...nodes].forEach((node, i) => {
    node.animate(
      [
        { opacity: 0, transform: `translateY(${RISE_PX}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: RISE_MS, delay: i * STAGGER_MS, easing: EASE, fill: "backwards" },
    );
  });
}

/** Fast start, gentle stop: 1 - (1 - t)^3. */
const easeOut = (/** @type {number} */ t) => 1 - (1 - t) ** EASE_POWER;

/**
 * Count a number up from zero into node's text.
 * @param {HTMLElement} node
 * @param {number} target
 * @param {number} [digits] decimal places shown
 */
export function countUp(node, target, digits = 0) {
  const show = (/** @type {number} */ v) => {
    node.textContent = v.toLocaleString("en-IN", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    });
  };
  if (reduced.matches) {
    show(target);
    return;
  }
  const start = performance.now();
  /** @param {number} now */
  const step = (now) => {
    const t = Math.min(1, (now - start) / COUNT_MS);
    show(target * easeOut(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * Sweep a gauge arc (drawn with pathLength 100) from empty to its value.
 * @param {SVGPathElement} arc
 * @param {number} percent 0 to 100
 */
export function sweep(arc, percent) {
  const end = { strokeDashoffset: String(100 - percent) };
  if (reduced.matches) return;
  arc.animate([{ strokeDashoffset: "100" }, end], { duration: SWEEP_MS, easing: EASE, fill: "backwards" });
}

/**
 * Chart bars grow from the baseline, left to right.
 * @param {Iterable<SVGElement>} bars
 */
export function grow(bars) {
  if (reduced.matches) return;
  [...bars].forEach((bar, i) => {
    bar.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
      duration: RISE_MS,
      delay: i * BAR_STAGGER_MS,
      easing: EASE,
      fill: "backwards",
    });
  });
}
