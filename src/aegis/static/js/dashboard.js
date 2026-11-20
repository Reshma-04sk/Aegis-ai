// Landing dashboard: one city's air across seven tiles. Real data only (POST /api/plan, cached
// per page view); a newer city choice always wins over a slower earlier request.
import { postPlan } from "./api.js";
import { byId, el } from "./dom.js";
import { rise } from "./motion.js";
import { dispersalTile, gaugeTile, hoursTile, particlesTile } from "./tiles/air.js";
import { nextStepTile, stationTile, verdictTile } from "./tiles/context.js";

/** @typedef {import("#api").PlanResponse} PlanResponse */

const bento = byId("live");
const status = byId("live-status");
const chips = /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll(".chip[data-city]")]);
const bodies = [...bento.querySelectorAll(".tile-body")].map((b) => /** @type {HTMLElement} */ (b));
/** @type {Map<string, PlanResponse>} */
const cache = new Map();
let current = 0;

/** @param {string} id */
const body = (id) => byId(`tile-${id}`);

/**
 * Loading (shimmer) or settled state on every tile.
 * @param {boolean} loading
 */
function setLoading(loading) {
  bento.setAttribute("aria-busy", String(loading));
  bodies.forEach((b) => b.classList.toggle("is-loading", loading));
}

/**
 * Fill every tile for one city, then let them rise in turn.
 * @param {PlanResponse} d
 * @param {string} city
 */
function render(d, city) {
  gaugeTile(body("gauge"), d);
  hoursTile(body("hours"), d);
  verdictTile(body("verdict"), d);
  particlesTile(body("pm"), d);
  dispersalTile(body("wind"), d);
  stationTile(body("station"), d);
  nextStepTile(body("cta"), city);
  setLoading(false);
  status.textContent = `${d.location}: US AQI ${Math.round(d.aqi)}, ${d.category}.`;
  rise(bento.querySelectorAll(".tile"));
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

/** @param {string} city */
async function show(city) {
  const token = ++current;
  setLoading(true);
  status.textContent = `Fetching the latest forecast for ${city}.`;
  try {
    const plan = await planFor(city);
    if (token === current) render(plan, city);
  } catch {
    if (token !== current) return;
    setLoading(false);
    bodies.forEach((b) => b.replaceChildren()); // never leave another city's numbers on screen
    const message = `The forecast for ${city} is unavailable right now. Try another city.`;
    body("gauge").replaceChildren(el("p", message, "error"));
    status.textContent = message;
  }
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    show(chip.dataset.city ?? "");
  });
});

show(chips.find((c) => c.getAttribute("aria-pressed") === "true")?.dataset.city ?? "Delhi");
