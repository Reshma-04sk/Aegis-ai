// Pure presentation helpers (no DOM, no React): text for numbers, times and errors, and the
// /api/plan request body built from raw form values.
import type { Category, FormValues, PlanRequest, Verdict } from "./types";

export const VERDICTS: Record<Verdict, { icon: string; label: string }> = {
  go: { icon: "✔", label: "Good to go" },
  caution: { icon: "⚠", label: "Take some care" },
  limit: { icon: "⛔", label: "Limit time outdoors" },
  avoid: { icon: "✖", label: "Stay indoors" },
};

const CFM_TO_M3H = 1.69901;
const ISO_TIME = { start: 11, end: 16 }; // "YYYY-MM-DDTHH:MM": the HH:MM part
const MINUTES_PER_HOUR = 60;
const HTTP = { invalid: 422, tooMany: 429 };

/** EPA category for an AQI value from ascending bands (the last has max null); null when missing. */
export function categoryFor(
  aqi: number | null | undefined,
  categories: readonly Category[],
): Category | null {
  if (aqi === null || aqi === undefined || Number.isNaN(aqi)) return null;
  return categories.find((c) => c.max === null || aqi <= c.max) ?? null;
}

/** "HH:MM" from an ISO local time, or an en dash when unknown. */
export function hourLabel(iso: unknown): string {
  return typeof iso === "string" && iso.length >= ISO_TIME.end
    ? iso.slice(ISO_TIME.start, ISO_TIME.end)
    : "–";
}

/** How long ago a reading was taken, in words. */
export function ageText(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min ago`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  return `${hours} h ${minutes % MINUTES_PER_HOUR} min ago`;
}

/** Locale number with at most `digits` decimals; "n/a" when missing. */
export function fmt(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "n/a";
  return value.toLocaleString("en", { maximumFractionDigits: digits });
}

/** Purifier CADR in m³/h from a form value in m³/h or CFM; null when empty or invalid. */
export function toM3h(value: string, unit: string): number | null {
  const n = Number(value);
  if (!value || Number.isNaN(n) || n <= 0) return null;
  return unit === "cfm" ? Math.round(n * CFM_TO_M3H) : Math.round(n);
}

const activitiesOf = (rows: FormValues["activities"]): NonNullable<PlanRequest["activities"]> =>
  rows
    .filter((a) => a.label.trim())
    .map((a) => ({
      label: a.label.trim(),
      activity: a.activity,
      duration_hours: Number(a.duration),
      earliest_hour: Number(a.earliest),
      latest_hour: Number(a.latest),
    }));

/** The room section, or undefined when no floor area was given. */
function homeOf(h: FormValues["home"]): PlanRequest["home"] {
  if (!(Number(h.area) > 0)) return undefined;
  const home: NonNullable<PlanRequest["home"]> = {
    floor_area_m2: Number(h.area),
    ceiling_height_m: Number(h.ceiling),
  };
  const cadr = toM3h(h.cadr, h.unit);
  if (cadr) home.purifier_cadr_m3h = cadr;
  return home;
}

/** The commute section, or undefined when no distance was given. */
function commuteOf(c: FormValues["commute"]): PlanRequest["commute"] {
  if (!(Number(c.distance) > 0)) return undefined;
  return {
    distance_km: Number(c.distance),
    current_mode: c.mode,
    occupants: Number(c.occupants),
    trips_per_week: Number(c.trips),
  };
}

/** Build the /api/plan payload from plain form values; drops empty optional sections. */
export function buildPayload(v: FormValues): PlanRequest {
  const payload: PlanRequest = {
    members: v.members.map((m) => ({ name: m.name.trim() || "You", groups: m.groups })),
  };
  if (v.coords) Object.assign(payload, v.coords);
  else payload.location = v.location.trim();
  payload.activities = activitiesOf(v.activities);
  const home = homeOf(v.home);
  const commute = commuteOf(v.commute);
  if (home) payload.home = home;
  if (commute) payload.commute = commute;
  if (v.note.trim()) payload.note = v.note.trim();
  return payload;
}

/** User-facing message for a failed /api/plan call. */
export function errorMessage(status: number, data: unknown): string {
  if (status === HTTP.invalid) return "Please check the highlighted values and try again.";
  if (status === HTTP.tooMany) return "Too many requests. Please wait a minute and try again.";
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  return "Something went wrong. Please try again.";
}
