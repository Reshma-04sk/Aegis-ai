// The 24-hour AQI bar chart, shared by the landing widget and the planner results. Bars are
// decorative (aria-hidden): every chart is paired with text or a table carrying the same numbers.
import { categoryOf } from "./config.js";
import { hourLabel } from "./format.js";
import { svg } from "./dom.js";

/** @typedef {import("#api").HourlyPoint} HourlyPoint */

/**
 * @typedef {object} ChartStyle
 * @property {number} floor smallest y-axis top, so a clean day still reads as low
 * @property {number} plotHeight height of the tallest possible bar
 * @property {number} barWidth width of one bar within its hourly slot
 * @property {number} labelEvery hours between time labels
 * @property {number} minBar smallest drawn bar height
 * @property {number} cornerRadius bar corner radius
 * @property {number} staggerMs per-bar delay for the CSS reveal transition (0 for none)
 */

const SLOT = 14; // horizontal space per hour, in SVG units
const AXIS_GAP = 4; // space between the bars' baseline and the plot height
const LABEL_DROP = 16; // time labels sit this far below the baseline
const BOTTOM_PAD = 8; // room under the labels for descenders
const WINDOW_HOURS = 2; // the highlighted "cleanest window" is two hours wide

/** @type {ChartStyle} Landing widget: rounded bars that grow in one after another. */
export const LIVE_CHART = {
  floor: 200,
  plotHeight: 104,
  barWidth: 10,
  labelEvery: 6,
  minBar: 2,
  cornerRadius: 2,
  staggerMs: 25,
};

/** @type {ChartStyle} Planner results: wider bars and denser labels. */
export const PLAN_CHART = {
  floor: 100,
  plotHeight: 110,
  barWidth: 12,
  labelEvery: 3,
  minBar: 0,
  cornerRadius: 0,
  staggerMs: 0,
};

/**
 * One time label under its slot; the first is left-aligned so it never clips at the edge.
 * @param {number} index
 * @param {string} time
 * @param {number} y
 */
function timeLabel(index, time, y) {
  const first = index === 0;
  const label = svg("text", {
    x: first ? 0 : index * SLOT + SLOT / 2,
    y,
    "text-anchor": first ? "start" : "middle",
  });
  label.textContent = hourLabel(time);
  return label;
}

/**
 * One bar, coloured by its EPA category.
 * @param {HourlyPoint & { us_aqi: number }} point
 * @param {number} index
 * @param {number} scale
 * @param {ChartStyle} style
 */
function bar(point, index, scale, style) {
  const baseline = style.plotHeight + AXIS_GAP;
  const height = Math.max(style.minBar, point.us_aqi * scale);
  const rect = svg("rect", {
    x: index * SLOT + (SLOT - style.barWidth) / 2,
    y: baseline - height,
    width: style.barWidth,
    height,
    rx: style.cornerRadius,
    class: `bar cat-${categoryOf(point.us_aqi)?.key ?? "unknown"}`,
  });
  if (style.staggerMs) rect.style.transitionDelay = `${index * style.staggerMs}ms`;
  return rect;
}

/**
 * Bar chart of hourly US AQI, optionally outlining a cleanest window.
 * @param {HourlyPoint[]} points one per hour
 * @param {ChartStyle} style
 * @param {number} [windowStart] index of the window's first hour, if any
 * @returns {SVGSVGElement}
 */
export function barChart(points, style, windowStart = -1) {
  const baseline = style.plotHeight + AXIS_GAP;
  const top = Math.max(style.floor, ...points.map((p) => p.us_aqi ?? 0));
  const plot = svg("svg", {
    viewBox: `0 0 ${points.length * SLOT} ${baseline + LABEL_DROP + BOTTOM_PAD}`,
    "aria-hidden": "true",
    focusable: "false",
  });
  points.forEach((point, index) => {
    if (point.us_aqi !== null) {
      plot.append(bar({ ...point, us_aqi: point.us_aqi }, index, style.plotHeight / top, style));
    }
    if (index % style.labelEvery === 0) plot.append(timeLabel(index, point.time, baseline + LABEL_DROP));
  });
  if (windowStart >= 0) {
    const width = WINDOW_HOURS * SLOT;
    plot.append(
      svg("rect", { x: windowStart * SLOT, y: 0, width, height: baseline, rx: 4, class: "window" }),
    );
  }
  return plot;
}
