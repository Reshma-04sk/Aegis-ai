// Dashboard tiles that put the air in context: today's call, the nearest monitor, the next step.
import { ageText, fmt } from "../format.js";
import { el, list, verdictBadge } from "../dom.js";
import { figure } from "./air.js";

/** @typedef {import("#api").PlanResponse} PlanResponse */

/**
 * The call for a healthy adult, its first action, and a pointer to the stricter personal plan.
 * @param {HTMLElement} body
 * @param {PlanResponse} d
 */
export function verdictTile(body, d) {
  const adult = d.members[0];
  body.replaceChildren(
    el("p", "For a healthy adult:", "meta"),
    verdictBadge(d.household_verdict),
    el("p", adult?.actions[0] ?? d.explanation, "lead"),
    list(adult?.reasons ?? [], "reasons"),
    el(
      "p",
      "Children, older adults and anyone with asthma or a heart condition get a stricter call in their plan.",
      "meta",
    ),
  );
}

/**
 * The nearest reference monitor's measured PM2.5, with distance and age; never mixed with the model.
 * @param {HTMLElement} body
 * @param {PlanResponse} d
 */
export function stationTile(body, d) {
  const s = d.station;
  const pm = s?.readings.find((r) => r.pollutant === "pm25" && r.value !== null);
  if (!s || !pm || pm.value === null) {
    body.replaceChildren(el("p", "No official monitor nearby has reported recently.", "meta"));
    return;
  }
  const age = pm.data_age_minutes === null ? "time unknown" : ageText(pm.data_age_minutes);
  body.replaceChildren(
    figure(pm.value, `${pm.unit} PM2.5`, 1),
    el(
      "p",
      `Measured at ${s.station_name} (${s.provider}), ${fmt(s.distance_km, 1)} km away, ${age}.`,
      "meta",
    ),
  );
}

/**
 * The step from a city's air to the household's own plan.
 * @param {HTMLElement} body
 * @param {string} city
 */
export function nextStepTile(body, city) {
  const link = el("a", `Plan a day in ${city}`, "button");
  link.href = `/plan?city=${encodeURIComponent(city)}`;
  body.replaceChildren(el("p", "Add who lives with you and what you have planned.", "meta"), link);
}
