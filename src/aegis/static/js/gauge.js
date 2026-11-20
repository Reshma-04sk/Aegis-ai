// AQI gauge: a half-dial on the EPA 0-500 scale. The track shows every category band in its own
// colour; the value arc is the current category's colour. Decorative (aria-hidden): the number and
// category are always given as text beside it.
import { CONFIG, categoryOf } from "./config.js";
import { svg } from "./dom.js";

const SCALE_MAX = 500;
const RADIUS = 80;
const CENTRE = { x: 100, y: 100 };
const BAND_GAP = 0.6; // percent of the dial left empty between bands

/**
 * Point on the dial for a fraction of the scale (0 = left, 1 = right).
 * @param {number} f
 */
function point(f) {
  const angle = Math.PI * (1 - f);
  return `${CENTRE.x + RADIUS * Math.cos(angle)} ${CENTRE.y - RADIUS * Math.sin(angle)}`;
}

/**
 * A dial segment from fraction a to fraction b, normalised to pathLength 100.
 * @param {number} a
 * @param {number} b
 * @param {string} className
 */
function arc(a, b, className) {
  return svg("path", {
    d: `M ${point(a)} A ${RADIUS} ${RADIUS} 0 0 1 ${point(b)}`,
    pathLength: 100,
    class: className,
  });
}

/** The track: one faint segment per EPA band. */
function track() {
  const group = svg("g", { class: "gauge-track" });
  let low = 0;
  CONFIG.categories.forEach((c) => {
    const high = Math.min(c.max ?? SCALE_MAX, SCALE_MAX) / SCALE_MAX;
    group.append(arc(low + BAND_GAP / 100, high, `band cat-${c.key}`));
    low = high;
  });
  return group;
}

/**
 * The dial for an AQI value, and the arc to animate with its fill percentage.
 * @param {number} aqi
 * @returns {{ node: SVGSVGElement, arc: SVGPathElement, percent: number }}
 */
export function gauge(aqi) {
  const percent = Math.round((Math.min(aqi, SCALE_MAX) / SCALE_MAX) * 100);
  const node = svg("svg", {
    viewBox: "0 0 200 112",
    class: "gauge",
    "aria-hidden": "true",
    focusable: "false",
  });
  const value = /** @type {SVGPathElement} */ (
    arc(0, 1, `gauge-value cat-${categoryOf(aqi)?.key ?? "unknown"}`)
  );
  value.style.strokeDasharray = "100";
  value.style.strokeDashoffset = String(100 - percent);
  node.append(track(), value);
  return { node, arc: value, percent };
}
