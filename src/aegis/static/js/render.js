// Result cards for a plan. Pure builders: each takes API data and returns DOM nodes.
import { ageText, fmt, hourLabel } from "./format.js";
import { card, categoryBadge, el, list, th, verdictBadge } from "./dom.js";
import { PLAN_CHART, barChart } from "./chart.js";
import { CONFIG, STALE_TEXT, categoryOf } from "./config.js";
import { renderCommute, renderIndoor } from "./impact.js";

/** @typedef {import("#api").PlanResponse} PlanResponse */
/** @typedef {import("#api").HourlyPoint} HourlyPoint */
/** @typedef {import("#api").ModeOption} ModeOption */

/**
 * Type guard for filtering out cards a plan does not have.
 * @template T
 * @param {T | null | undefined | false} x
 * @returns {x is T}
 */
const present = (x) => x !== null && x !== undefined && x !== false;

// Readings under 1 (ppm gases such as CO) need more decimals to be meaningful.
const SMALL_VALUE_DIGITS = 3;
/** @type {Record<string, string>} */
const STATION_STATUS = {
  none_nearby:
    `No monitoring station within ${CONFIG.stationRadiusKm} km has reported in the last ` +
    `${CONFIG.stationRecentHours} hours, so only the model estimate above is available.`,
  unavailable: "Station measurements are unavailable right now; the model estimate above is unaffected.",
};
/** @type {Record<"gemini" | "rules" | "pending", string>} */
export const SOURCE_TEXT = {
  gemini: "Written by Google Gemini from the computed plan; it cannot change verdicts or numbers.",
  rules: "Rule-based briefing.",
  pending: "Rule-based briefing; asking Google Gemini for a personalised version…",
};

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
function renderOverview(d) {
  const section = card(d.location, "overview");
  const p = d.provenance;
  const num = el("p", undefined, `aqi-number cat-${categoryOf(d.aqi)?.key ?? "unknown"}`);
  num.append(el("span", String(Math.round(d.aqi))), el("span", "US AQI", "unit"));
  const side = el("div");
  side.append(
    categoryBadge(d.aqi),
    el("p", "Household verdict:", "label"),
    verdictBadge(d.household_verdict),
  );
  const top = el("div", undefined, "overview-top");
  top.append(num, side);

  const meta = el("p", undefined, "meta");
  meta.append(
    document.createTextNode(
      `Model estimate (${p.model}) for ${p.observed_at.replace("T", " ")} local time · fetched ${ageText(p.data_age_minutes)}. `,
    ),
  );
  if (p.stale) meta.append(el("strong", STALE_TEXT, "stale"));
  section.append(top, meta, ...[pollutantList(d), weatherNote(d.weather)].filter(present));
  return section;
}

/** @param {import("#api").StationReading} r */
function stationReading(r) {
  const div = el("div");
  const value =
    r.value === null ? "no valid reading" : `${fmt(r.value, r.value < 1 ? SMALL_VALUE_DIGITS : 1)} ${r.unit}`;
  const age = r.data_age_minutes === null ? "time unknown" : ageText(r.data_age_minutes);
  div.append(el("dt", r.label), el("dd", value), el("dd", age, "help"));
  if (r.stale) div.append(el("dd", STALE_TEXT, "stale"));
  return div;
}

/** @param {PlanResponse} d */
function renderStation(d) {
  if (d.station_status === "not_configured") return null;
  const section = card("Nearest monitoring station", "station");
  const s = d.station;
  if (!s) {
    section.append(el("p", STATION_STATUS[d.station_status], "help"));
    return section;
  }
  const kind = s.is_reference_monitor ? "reference monitor" : "sensor";
  const dl = el("dl", undefined, "pollutants");
  dl.append(...s.readings.map(stationReading));
  section.append(
    el(
      "p",
      `Measured at ${s.station_name} (${s.provider} ${kind}), ${fmt(s.distance_km, 1)} km away. Station measurement, shown beside the model estimate and never mixed into it; units as reported by the provider.`,
      "meta",
    ),
    dl,
    el("p", s.attribution, "help"),
  );
  return section;
}

/** @param {PlanResponse} d */
function renderBriefing(d) {
  const section = card("Your briefing", "briefing");
  section.append(
    el("p", d.explanation, "lead briefing-text"),
    el("p", SOURCE_TEXT[d.briefing_id ? "pending" : d.explanation_source], "help briefing-source"),
  );
  return section;
}

/** @param {PlanResponse} d */
function renderMembers(d) {
  const section = card("Who should do what");
  const grid = el("div", undefined, "members-grid");
  d.members.forEach((m) => {
    const art = el("article", undefined, `member verdict-border-${m.verdict}`);
    art.append(el("h3", m.name), verdictBadge(m.verdict), list(m.reasons, "reasons"), list(m.actions));
    grid.append(art);
  });
  section.append(grid);
  return section;
}

/** @param {import("#api").ScheduledActivity} s */
function scheduleItem(s) {
  const li = el("li");
  li.append(el("strong", s.label));
  if (s.window) {
    li.append(
      document.createTextNode(
        ` · ${hourLabel(s.window.start)} to ${hourLabel(s.window.end)} · AQI ${fmt(s.window.mean_aqi)} `,
      ),
    );
    if (s.verdict) li.append(verdictBadge(s.verdict));
  }
  li.append(el("p", s.advice));
  if (s.exposure_note) li.append(el("p", s.exposure_note, "help"));
  return li;
}

/** @param {PlanResponse} d */
function renderSchedule(d) {
  const section = card("Your low-exposure day");
  const w = d.best_window;
  if (w) {
    section.append(
      el(
        "p",
        w.starts_now
          ? "Right now is the cleanest time in the next 24 hours."
          : `Cleanest 2 hours in the next day: ${hourLabel(w.start)} to ${hourLabel(w.end)} (average AQI ${fmt(w.mean_aqi)}).`,
        "lead",
      ),
    );
  }
  if (d.schedule.length) {
    const ol = el("ol", undefined, "schedule");
    ol.append(...d.schedule.map(scheduleItem));
    section.append(ol);
  }
  section.append(renderChart(d.hourly));
  return section;
}

/** @param {HourlyPoint[]} hourly */
function hourlyTable(hourly) {
  const table = el("table");
  table.append(el("caption", "US AQI and PM2.5 by hour (model forecast)", "sr-only"));
  const head = table.createTHead().insertRow();
  ["Time", "US AQI", "Category", "PM2.5 µg/m³"].forEach((text) => head.append(th(text, { scope: "col" })));
  const body = table.createTBody();
  hourly.forEach((p) => {
    const row = body.insertRow();
    [hourLabel(p.time), fmt(p.us_aqi), categoryOf(p.us_aqi)?.name || "n/a", fmt(p.pm2_5, 1)].forEach(
      (text) => {
        row.insertCell().textContent = text;
      },
    );
  });
  return table;
}

/** @param {HourlyPoint[]} hourly */
function renderChart(hourly) {
  const figure = el("figure", undefined, "chart");
  const details = el("details");
  details.append(el("summary", "Hourly values (table)"), hourlyTable(hourly));
  figure.append(el("figcaption", "US AQI forecast, next 24 hours"), barChart(hourly, PLAN_CHART), details);
  return figure;
}

// Every card for a plan, in reading order.
/**
 * @param {PlanResponse} d
 * @returns {HTMLElement[]}
 */
export function renderPlan(d) {
  return [
    renderOverview(d),
    renderStation(d),
    renderBriefing(d),
    renderMembers(d),
    renderSchedule(d),
    d.indoor && renderIndoor(d.indoor),
    d.commute && renderCommute(d.commute),
    el("p", d.disclaimer, "help disclaimer"),
  ].filter(present);
}
