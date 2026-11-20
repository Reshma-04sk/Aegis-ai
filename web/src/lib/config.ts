// The constants generated from Python (`uv run aegis-config`), typed once. The browser has no
// second copy of AQI bands, labels, limits or form choices.
import generated from "../generated/config.json";
import { categoryFor } from "./format";
import type { Category, FrontEndConfig } from "./types";

export const CONFIG: FrontEndConfig = generated;

/** EPA category for an AQI value; null when the value is missing. */
export const categoryOf = (aqi: number | null | undefined): Category | null =>
  categoryFor(aqi, CONFIG.categories);

/** CSS key of an AQI value's band ("unknown" when missing), used for colour classes. */
export const categoryKey = (aqi: number | null | undefined): string => categoryOf(aqi)?.key ?? "unknown";

/** Label shown when a reading is older than the server's staleness limit. */
export const STALE_TEXT = `Stale: older than ${CONFIG.staleAfterHours} hours.`;

/** Short label for a pollutant key ("pm2_5" → "PM2.5"), or the key itself. */
export const pollutantLabel = (key: string): string => CONFIG.pollutantLabels[key] ?? key;
