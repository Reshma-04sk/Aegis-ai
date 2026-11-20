// Station card: measured readings from the nearest monitor, shown beside (never mixed into) the model.
import { ageText, fmt } from "../format.js";
import { card, el } from "../dom.js";
import { CONFIG, STALE_TEXT } from "../config.js";

/** @typedef {import("#api").PlanResponse} PlanResponse */

// Readings under 1 (ppm gases such as CO) need more decimals to be meaningful.
const SMALL_VALUE_DIGITS = 3;
/** @type {Record<string, string>} */
const STATION_STATUS = {
  none_nearby:
    `No monitoring station within ${CONFIG.stationRadiusKm} km has reported in the last ` +
    `${CONFIG.stationRecentHours} hours, so only the model estimate above is available.`,
  unavailable: "Station measurements are unavailable right now; the model estimate above is unaffected.",
};

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

/** @param {NonNullable<PlanResponse["station"]>} s */
function measuredAt(s) {
  const kind = s.is_reference_monitor ? "reference monitor" : "sensor";
  return el(
    "p",
    `Measured at ${s.station_name} (${s.provider} ${kind}), ${fmt(s.distance_km, 1)} km away. Station measurement, shown beside the model estimate and never mixed into it; units as reported by the provider.`,
    "meta",
  );
}

/**
 * Nearest-station card; null when no station key is configured.
 * @param {PlanResponse} d
 */
export function renderStation(d) {
  if (d.station_status === "not_configured") return null;
  const section = card("Nearest monitoring station", "station");
  const s = d.station;
  if (!s) {
    section.append(el("p", STATION_STATUS[d.station_status], "help"));
    return section;
  }
  const dl = el("dl", undefined, "pollutants");
  dl.append(...s.readings.map(stationReading));
  section.append(measuredAt(s), dl, el("p", s.attribution, "help"));
  return section;
}
