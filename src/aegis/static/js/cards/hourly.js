// Hourly forecast figure: the bar chart plus the same numbers as an accessible table.
import { fmt, hourLabel } from "../format.js";
import { el, th } from "../dom.js";
import { PLAN_CHART, barChart } from "../chart.js";
import { categoryOf } from "../config.js";

/** @typedef {import("#api").HourlyPoint} HourlyPoint */

/** @param {HourlyPoint[]} hourly */
function hourlyTable(hourly) {
  const table = el("table");
  table.append(el("caption", "US AQI and PM2.5 by hour (model forecast)", "sr-only"));
  const head = table.createTHead().insertRow();
  ["Time", "US AQI", "Category", "PM2.5 µg/m³"].forEach((text) => head.append(th(text, { scope: "col" })));
  const body = table.createTBody();
  hourly.forEach((p) => {
    const row = body.insertRow();
    const cells = [hourLabel(p.time), fmt(p.us_aqi), categoryOf(p.us_aqi)?.name || "n/a", fmt(p.pm2_5, 1)];
    cells.forEach((text) => {
      row.insertCell().textContent = text;
    });
  });
  return table;
}

/**
 * Chart with a collapsible data table, so the values never depend on the graphic.
 * @param {HourlyPoint[]} hourly
 */
export function renderChart(hourly) {
  const figure = el("figure", undefined, "chart");
  const details = el("details");
  details.append(el("summary", "Hourly values (table)"), hourlyTable(hourly));
  figure.append(el("figcaption", "US AQI forecast, next 24 hours"), barChart(hourly, PLAN_CHART), details);
  return figure;
}
