// The constants the server renders into every page (see pages.front_end_config in Python), read
// once. The browser has no second copy of AQI bands, labels or limits.
import { categoryFor } from "./format.js";

/** @typedef {import("#api").FrontEndConfig} FrontEndConfig */
/** @typedef {import("#api").Category} Category */

const source = document.getElementById("aegis-config");
if (!source) throw new Error("#aegis-config is missing from the page");

/** @type {FrontEndConfig} */
export const CONFIG = JSON.parse(source.textContent ?? "");

/**
 * EPA category for an AQI value; null when the value is missing.
 * @param {number | null | undefined} aqi
 * @returns {Category | null}
 */
export const categoryOf = (aqi) => categoryFor(aqi, CONFIG.categories);

/** Index of an AQI value's band (0 = Good), or -1 when the value is missing. */
export const categoryIndex = (/** @type {number} */ aqi) => {
  const category = categoryOf(aqi);
  return category ? CONFIG.categories.indexOf(category) : -1;
};

/** Label shown when a reading is older than the server's staleness limit. */
export const STALE_TEXT = `Stale: older than ${CONFIG.staleAfterHours} hours.`;
