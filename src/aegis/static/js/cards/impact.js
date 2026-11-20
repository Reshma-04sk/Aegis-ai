// Impact cards for a plan: the air at home, and the two separate impacts of a commute choice
// (climate emissions for the whole week, and the PM2.5 you breathe on each trip).
import { fmt } from "./format.js";
import { card, el, list, th } from "./dom.js";

/** @typedef {import("#api").ModeOption} ModeOption */

/**
 * Indoor air card: room volume, purifier sizing and steps for today.
 * @param {import("#api").IndoorAdvice} i
 */
export function renderIndoor(i) {
  const section = card("Indoor air plan");
  const facts = [
    `Room volume: ${fmt(i.room_volume_m3)} m³. Recommended purifier CADR: about ${fmt(i.recommended_cadr_m3h)} m³/h (EPA sizing chart).`,
  ];
  if (i.purifier_cadr_m3h) {
    facts.push(
      `Your purifier gives about ${fmt(i.clean_air_changes_per_hour, 1)} clean-air changes per hour and could cut particles by 90% in roughly ${i.minutes_to_cut_particles_90pct} minutes (ideal conditions). ${i.purifier_adequate ? "It is suitably sized." : "It is undersized for this room."}`,
    );
  }
  const details = el("details");
  details.append(el("summary", "Assumptions"), list(i.assumptions));
  section.append(list(facts, "facts"), el("h3", "Steps for today"), list(i.tips), details);
  return section;
}

// Two header rows keep the two impacts apart: climate (whole week) and personal exposure (per trip).
/** @param {HTMLTableElement} table */
function commuteHead(table) {
  const head = table.createTHead();
  head
    .insertRow()
    .append(
      th("Mode", { rowspan: "2", scope: "col" }),
      th("Time per trip", { rowspan: "2", scope: "col" }),
      th("Climate impact", { colspan: "2", scope: "colgroup" }),
      th("Your exposure", { scope: "col" }),
    );
  head
    .insertRow()
    .append(
      th("kg CO2e / week", { scope: "col" }),
      th("kg CO2e avoided / week", { scope: "col" }),
      th("µg PM2.5 inhaled / trip", { scope: "col" }),
    );
}

/**
 * @param {HTMLTableSectionElement} body
 * @param {ModeOption} o
 */
function commuteRow(body, o) {
  const row = body.insertRow();
  row.append(th(o.is_current ? `${o.label} (current)` : o.label, { scope: "row" }));
  [
    `${o.minutes_per_trip} min`,
    fmt(o.emissions_kg_co2e_per_week, 2),
    o.is_current ? "–" : fmt(o.emissions_avoided_kg_co2e_per_week, 2),
    fmt(o.inhaled_pm25_ug_per_trip, 1),
  ].forEach((text) => {
    row.insertCell().textContent = text;
  });
  if (o.is_current) row.className = "current";
}

/**
 * Commute card: weekly emissions and per-trip exposure for each mode, kept in separate columns.
 * @param {import("#api").CommuteAdvice} c
 */
export function renderCommute(c) {
  const section = card("Greener commute: the impact of your choice");
  const table = el("table", undefined, "commute");
  table.append(
    el(
      "caption",
      "Two separate impacts: climate emissions (whole week) and the PM2.5 you personally breathe in (per trip, at today's levels).",
    ),
  );
  commuteHead(table);
  const body = table.createTBody();
  c.options.forEach((o) => commuteRow(body, o));
  // A scrollable region must be focusable so keyboard users can scroll it.
  const scroll = el("div", undefined, "table-scroll");
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", "Commute comparison table");
  scroll.append(table);
  const details = el("details");
  details.append(el("summary", "Assumptions and sources"), list([...c.assumptions, ...c.sources]));
  section.append(el("p", c.summary, "lead"), scroll, details);
  return section;
}
