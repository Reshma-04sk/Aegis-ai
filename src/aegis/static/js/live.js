// "Right now" on the landing page: live forecast + nearest station for a few cities.
// Real data only (POST /api/plan, cached server-side); text via textContent, never innerHTML.
import { ageText, fmt, hourLabel } from "./format.js";
import { byId, categoryBadge, el } from "./dom.js";
import { LIVE_CHART, barChart } from "./chart.js";
import { STALE_TEXT, categoryOf } from "./config.js";
import { postPlan } from "./api.js";
import { countUp } from "./count-up.js";

/** @typedef {import("#api").PlanResponse} PlanResponse */

const box = byId("live");
const chips = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll(".chip[data-city]")]);
/** @type {Map<string, PlanResponse>} */
const cache = new Map();
let current = 0;
const HOURS_SHOWN = 24;
/** @param {PlanResponse} d */
function chart(d) {
  const hours = d.hourly.slice(0, HOURS_SHOWN);
  const win = d.best_window;
  const fig = el("figure", undefined, "live-chart");
  const cap = el("figcaption");
  cap.textContent = win
    ? `Next 24 hours of forecast US AQI. Cleanest two hours: ${hourLabel(win.start)} to ` +
      `${hourLabel(win.end)}, average ${fmt(win.mean_aqi)}.`
    : "Next 24 hours of forecast US AQI.";
  fig.append(barChart(hours, LIVE_CHART, win ? hours.findIndex((h) => h.time === win.start) : -1), cap);
  return fig;
}

/**
 * One line on the nearest station's measured PM2.5, or null when there is none.
 * @param {PlanResponse["station"]} s
 */
function stationLine(s) {
  const pm = s?.readings.find((r) => r.pollutant === "pm25" && r.value !== null);
  if (!s || !pm) return null;
  const age = pm.data_age_minutes === null ? "time unknown" : ageText(pm.data_age_minutes);
  const text = `Measured at ${s.station_name} (${s.provider}), ${fmt(s.distance_km, 1)} km away: PM2.5 ${fmt(pm.value, 1)} ${pm.unit}, ${age}.`;
  return el("p", text, "meta");
}

/**
 * Place, AQI (counted up), category and data age.
 * @param {PlanResponse} d
 * @param {HTMLElement} value the span the AQI is counted into
 */
function nowSummary(d, value) {
  const left = el("div", undefined, "live-now");
  const num = el("p", undefined, `live-aqi cat-${categoryOf(d.aqi)?.key ?? "unknown"}`);
  num.append(value, el("span", "US AQI forecast now", "unit"));
  const stale = d.provenance.stale ? ` ${STALE_TEXT}` : "";
  const age = el(
    "p",
    `Model estimate (CAMS), fetched ${ageText(d.provenance.data_age_minutes)}.${stale}`,
    "meta",
  );
  left.append(el("p", d.location, "live-place"), num, categoryBadge(d.aqi), age);
  return left;
}

/**
 * @param {PlanResponse} d
 * @param {string} city
 */
function render(d, city) {
  const value = el("span", "0");
  const left = nowSummary(d, value);
  const station = stationLine(d.station);
  if (station) left.append(station);
  const cta = el("a", `Plan a day in ${city}`, "button");
  cta.href = `/plan?city=${encodeURIComponent(city)}`;
  left.append(cta);
  box.replaceChildren(left, chart(d));
  box.setAttribute("aria-busy", "false");
  countUp(value, Math.round(d.aqi));
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("is-in")));
}

/**
 * The city's plan, fetched once per page view.
 * @param {string} city
 * @returns {Promise<PlanResponse>}
 */
async function planFor(city) {
  const cached = cache.get(city);
  if (cached) return cached;
  const response = await postPlan({ location: city });
  if (!response.ok || !response.data) throw new Error(String(response.status));
  cache.set(city, response.data);
  return response.data;
}

/**
 * Show one city, fetching it once; a newer click wins over a slower earlier fetch.
 * @param {string} city
 */
async function show(city) {
  const token = ++current;
  box.classList.remove("is-in");
  box.setAttribute("aria-busy", "true");
  box.replaceChildren(el("p", `Fetching the latest forecast for ${city}.`, "help"));
  try {
    const plan = await planFor(city);
    if (token === current) render(plan, city);
  } catch {
    if (token !== current) return;
    box.setAttribute("aria-busy", "false");
    box.replaceChildren(
      el(
        "p",
        `The forecast for ${city} is unavailable right now. Try another city, or plan your own day.`,
        "error",
      ),
    );
  }
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    show(chip.dataset.city ?? "");
  });
});

// Fetch only when the section comes near the viewport, so a quick visit costs no API call.
const watcher = new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      watcher.disconnect();
      const pressed = chips.find((c) => c.getAttribute("aria-pressed") === "true") ?? chips[0];
      show(pressed.dataset.city ?? "");
    }
  },
  { rootMargin: "300px" },
);
watcher.observe(box);
