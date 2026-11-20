// Dashboard tiles about the air itself: the gauge, the 24-hour chart, particles and dispersal.
import { ageText, fmt, hourLabel } from "../format.js";
import { categoryBadge, el } from "../dom.js";
import { LIVE_CHART, barChart } from "../chart.js";
import { CONFIG, STALE_TEXT } from "../config.js";
import { gauge } from "../gauge.js";
import { countUp, grow, sweep } from "../motion.js";

/** @typedef {import("#api").PlanResponse} PlanResponse */

const HOURS_SHOWN = 24;

/**
 * Big number with a small unit, counted up from zero.
 * @param {number} value
 * @param {string} unit
 * @param {number} [digits]
 */
export function figure(value, unit, digits = 0) {
  const p = el("p", undefined, "figure");
  const number = el("span", "0", "figure-value");
  p.append(number, el("span", unit, "figure-unit"));
  countUp(number, value, digits);
  return p;
}

/**
 * The dial, the AQI as a number with its category, and how old the estimate is.
 * @param {HTMLElement} body
 * @param {PlanResponse} d
 */
export function gaugeTile(body, d) {
  const dial = gauge(d.aqi);
  const stale = d.provenance.stale ? ` ${STALE_TEXT}` : "";
  const age = `Model estimate (CAMS), fetched ${ageText(d.provenance.data_age_minutes)}.${stale}`;
  body.replaceChildren(
    el("p", d.location, "place"),
    dial.node,
    figure(Math.round(d.aqi), "US AQI"),
    categoryBadge(d.aqi),
    el("p", age, "meta"),
  );
  sweep(dial.arc, dial.percent);
}

/**
 * The next 24 hours as bars, with the cleanest two hours bracketed and named.
 * @param {HTMLElement} body
 * @param {PlanResponse} d
 */
export function hoursTile(body, d) {
  const hours = d.hourly.slice(0, HOURS_SHOWN);
  const win = d.best_window;
  const start = win ? hours.findIndex((h) => h.time === win.start) : -1;
  const chart = el("figure", undefined, "hours-chart");
  const caption = win
    ? `Cleanest two hours: ${hourLabel(win.start)} to ${hourLabel(win.end)}, average AQI ${fmt(win.mean_aqi)}.`
    : "No complete two-hour window in the forecast.";
  chart.append(barChart(hours, LIVE_CHART, start), el("figcaption", caption));
  body.replaceChildren(chart);
  grow(chart.querySelectorAll(".bar"));
}

/**
 * Modelled PM2.5 now and the pollutant driving the AQI.
 * @param {HTMLElement} body
 * @param {PlanResponse} d
 */
export function particlesTile(body, d) {
  const pm = d.pollutants.pm2_5;
  const main = d.dominant_pollutant ? CONFIG.pollutantLabels[d.dominant_pollutant] : null;
  body.replaceChildren(
    pm === null || pm === undefined
      ? el("p", "No PM2.5 value in this forecast.", "meta")
      : figure(pm, "µg/m³ PM2.5", 1),
    el("p", main ? `${main} drives today's AQI.` : "No single pollutant dominates.", "meta"),
  );
}

/**
 * When the mixing layer is deepest, the hour smog spreads out most.
 * @param {HTMLElement} body
 * @param {PlanResponse} d
 */
export function dispersalTile(body, d) {
  const w = d.weather;
  if (!w || !w.peak_mixing_time) {
    body.replaceChildren(el("p", "No mixing-layer forecast for this place.", "meta"));
    return;
  }
  const now = w.boundary_layer_m === null ? "" : ` Now ${fmt(w.boundary_layer_m)} m deep.`;
  body.replaceChildren(
    el("p", hourLabel(w.peak_mixing_time), "figure figure-time"),
    el(
      "p",
      `The air layer is deepest then (${fmt(w.peak_boundary_layer_m)} m), so smog spreads out.${now}`,
      "meta",
    ),
  );
}
