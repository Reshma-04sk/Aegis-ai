// Overview card: AQI number, category, household verdict, provenance, pollutants, weather.
import { ageText, fmt, hourLabel } from "../format.js";
import { card, categoryBadge, el, verdictBadge } from "../dom.js";
import { CONFIG, STALE_TEXT, categoryOf } from "../config.js";
import { present } from "./present.js";
import { gauge } from "../gauge.js";
import { countUp, sweep } from "../motion.js";

/** @typedef {import("#api").PlanResponse} PlanResponse */

/** @param {PlanResponse} d */
function pollutantList(d) {
  const rows = Object.entries(d.pollutants).filter(([, v]) => v !== null);
  if (!rows.length) return null;
  const dl = el("dl", undefined, "pollutants");
  rows.forEach(([key, value]) => {
    const div = el("div", undefined, key === d.dominant_pollutant ? "dominant" : undefined);
    div.append(el("dt", CONFIG.pollutantLabels[key] || key), el("dd", `${fmt(value, 1)} µg/m³`));
    dl.append(div);
  });
  return dl;
}

/** @param {PlanResponse["weather"]} w */
function weatherNote(w) {
  if (!w || w.boundary_layer_m === null) return null;
  let text = `Wind ${fmt(w.wind_speed_kmh)} km/h, mixing layer ${fmt(w.boundary_layer_m)} m.`;
  if (w.peak_mixing_time && (w.peak_boundary_layer_m ?? 0) > w.boundary_layer_m) {
    text += ` Smog disperses better when this layer is deeper; it is forecast to be deepest around ${hourLabel(w.peak_mixing_time)} (${fmt(w.peak_boundary_layer_m)} m).`;
  }
  return el("p", text, "weather");
}

/** @param {PlanResponse} d */
function headline(d) {
  const dial = gauge(d.aqi);
  const num = el("p", undefined, `aqi-number cat-${categoryOf(d.aqi)?.key ?? "unknown"}`);
  const value = el("span", "0");
  num.append(value, el("span", "US AQI", "unit"));
  countUp(value, Math.round(d.aqi));
  sweep(dial.arc, dial.percent);
  const dialBox = el("div", undefined, "overview-dial");
  dialBox.append(dial.node, num);
  const side = el("div");
  side.append(
    categoryBadge(d.aqi),
    el("p", "Household verdict:", "label"),
    verdictBadge(d.household_verdict),
  );
  const top = el("div", undefined, "overview-top");
  top.append(dialBox, side);
  return top;
}

/** @param {PlanResponse["provenance"]} p */
function provenance(p) {
  const meta = el("p", undefined, "meta");
  const when = p.observed_at.replace("T", " ");
  meta.append(
    document.createTextNode(
      `Model estimate (${p.model}) for ${when} local time · fetched ${ageText(p.data_age_minutes)}. `,
    ),
  );
  if (p.stale) meta.append(el("strong", STALE_TEXT, "stale"));
  return meta;
}

/**
 * The first card: where, how bad, for whom, and how old the data is.
 * @param {PlanResponse} d
 */
export function renderOverview(d) {
  const section = card(d.location, "overview");
  const extras = [pollutantList(d), weatherNote(d.weather)].filter(present);
  section.append(headline(d), provenance(d.provenance), ...extras);
  return section;
}
