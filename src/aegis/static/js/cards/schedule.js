// Schedule card: the cleanest window, each activity in its slot, and the hourly forecast.
import { fmt, hourLabel } from "../format.js";
import { card, el, verdictBadge } from "../dom.js";
import { renderChart } from "./hourly.js";

/** @typedef {import("#api").PlanResponse} PlanResponse */

/** @param {import("#api").ScheduledActivity} s */
function scheduleItem(s) {
  const li = el("li");
  li.append(el("strong", s.label));
  if (s.window) {
    const slot = ` · ${hourLabel(s.window.start)} to ${hourLabel(s.window.end)} · AQI ${fmt(s.window.mean_aqi)} `;
    li.append(document.createTextNode(slot));
    if (s.verdict) li.append(verdictBadge(s.verdict));
  }
  li.append(el("p", s.advice));
  if (s.exposure_note) li.append(el("p", s.exposure_note, "help"));
  return li;
}

/** @param {NonNullable<PlanResponse["best_window"]>} w */
function windowText(w) {
  if (w.starts_now) return "Right now is the cleanest time in the next 24 hours.";
  return `Cleanest 2 hours in the next day: ${hourLabel(w.start)} to ${hourLabel(w.end)} (average AQI ${fmt(w.mean_aqi)}).`;
}

/**
 * The low-exposure day: best window, scheduled activities, hourly chart.
 * @param {PlanResponse} d
 */
export function renderSchedule(d) {
  const section = card("Your low-exposure day");
  if (d.best_window) section.append(el("p", windowText(d.best_window), "lead"));
  if (d.schedule.length) {
    const ol = el("ol", undefined, "schedule");
    ol.append(...d.schedule.map(scheduleItem));
    section.append(ol);
  }
  section.append(renderChart(d.hourly));
  return section;
}
