// "Right now" on the landing page: live forecast + nearest station for a few cities.
// Real data only (POST /api/plan, cached server-side); text via textContent, never innerHTML.
import { ageText, fmt, hourLabel } from "./format.js";
import { byId, categoryBadge, el } from "./dom.js";
import { LIVE_CHART, barChart } from "./chart.js";
import { STALE_TEXT, categoryOf } from "./config.js";

/** @typedef {import("#api").PlanResponse} PlanResponse */

const box = byId("live");
const chips = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll(".chip[data-city]")]);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
/** @type {Map<string, PlanResponse>} */
const cache = new Map();
let current = 0;
const HOURS_SHOWN = 24;
const COUNT_UP_MS = 900;

/** Fast start, gentle stop: 1 - (1 - t)^3. */
const easeOutCubic = (/** @type {number} */ t) => 1 - (1 - t) * (1 - t) * (1 - t);

/**
 * Count a number up to its value (instantly with reduced motion).
 * @param {HTMLElement} node
 * @param {number} target
 */
function countUp(node, target) {
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
 * @param {PlanResponse} d
 * @param {string} city
 */
function render(d, city) {
  const cat = categoryOf(d.aqi);
  const left = el("div", undefined, "live-now");
  const num = el("p", undefined, `live-aqi cat-${cat?.key ?? "unknown"}`);
  const value = el("span", "0");
  num.append(value, el("span", "US AQI forecast now", "unit"));
  left.append(el("p", d.location, "live-place"), num, categoryBadge(d.aqi));
  const p = d.provenance;
  left.append(
    el(
      "p",
      `Model estimate (CAMS), fetched ${ageText(p.data_age_minutes)}.${p.stale ? ` ${STALE_TEXT}` : ""}`,
      "meta",
    ),
  );
  const s = d.station;
  const pm = s?.readings.find((r) => r.pollutant === "pm25" && r.value !== null);
  if (s && pm) {
    left.append(
      el(
        "p",
        `Measured at ${s.station_name} (${s.provider}), ${fmt(s.distance_km, 1)} km away: PM2.5 ${fmt(pm.value, 1)} ${pm.unit}, ${pm.data_age_minutes === null ? "time unknown" : ageText(pm.data_age_minutes)}.`,
        "meta",
      ),
    );
  }
  const cta = el("a", `Plan a day in ${city}`, "button");
  cta.href = `/plan?city=${encodeURIComponent(city)}`;
  left.append(cta);
  box.replaceChildren(left, chart(d));
  box.setAttribute("aria-busy", "false");
  countUp(value, Math.round(d.aqi));
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("is-in")));
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
    let plan = cache.get(city);
    if (!plan) {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: city }),
      });
      if (!response.ok) throw new Error(String(response.status));
      plan = /** @type {PlanResponse} */ (await response.json());
      cache.set(city, plan);
    }
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
