// API contract for the front end. Mirrors the Pydantic models in src/aegis/models one-to-one,
// so a changed API field fails type-checking wherever the UI reads it.

export type Verdict = "go" | "caution" | "limit" | "avoid";
export type Group = "asthma" | "child" | "elderly" | "pregnant" | "heart_condition";
export type ActivityKind = "rest" | "walk" | "commute" | "cycle" | "run";
export type BriefingSource = "gemini" | "rules";
export type StationStatus = "ok" | "not_configured" | "none_nearby" | "unavailable";

export interface HourlyPoint {
  time: string;
  us_aqi: number | null;
  pm2_5: number | null;
}

export interface Weather {
  wind_speed_kmh: number | null;
  boundary_layer_m: number | null;
  peak_mixing_time: string | null;
  peak_boundary_layer_m: number | null;
}

export interface Provenance {
  source: string;
  model: string;
  kind: "model_estimate";
  observed_at: string;
  retrieved_at: string;
  data_age_minutes: number;
  stale: boolean;
  attribution: string;
  licence_url: string;
}

export interface TimeWindow {
  start: string;
  end: string;
  mean_aqi: number;
  starts_now: boolean;
}

export interface MemberAdvice {
  name: string;
  groups: Group[];
  verdict: Verdict;
  reasons: string[];
  actions: string[];
}

export interface ScheduledActivity {
  label: string;
  activity: ActivityKind;
  window: TimeWindow | null;
  verdict: Verdict | null;
  advice: string;
  inhaled_pm25_ug: number | null;
  inhaled_pm25_now_ug: number | null;
  exposure_note: string | null;
}

export interface IndoorAdvice {
  room_volume_m3: number;
  recommended_cadr_m3h: number;
  purifier_cadr_m3h: number | null;
  clean_air_changes_per_hour: number | null;
  minutes_to_cut_particles_90pct: number | null;
  purifier_adequate: boolean | null;
  airing_window: TimeWindow | null;
  tips: string[];
  assumptions: string[];
}

export interface ModeOption {
  mode: string;
  label: string;
  minutes_per_trip: number;
  emissions_kg_co2e_per_week: number;
  emissions_avoided_kg_co2e_per_week: number;
  inhaled_pm25_ug_per_trip: number | null;
  is_current: boolean;
}

export interface CommuteAdvice {
  options: ModeOption[];
  summary: string;
  assumptions: string[];
  sources: string[];
}

export interface StationReading {
  kind: "station_observation";
  station_id: number;
  provider: string;
  pollutant: string;
  label: string;
  value: number | null;
  unit: string;
  observed_at: string | null;
  retrieved_at: string;
  data_age_minutes: number | null;
  stale: boolean;
}

export interface StationObservation {
  station_id: number;
  station_name: string;
  provider: string;
  is_reference_monitor: boolean;
  distance_km: number;
  readings: StationReading[];
  attribution: string;
  source: string;
  source_url: string;
}

export interface PlanResponse {
  location: string;
  aqi: number;
  category: string;
  dominant_pollutant: string | null;
  pollutants: Record<string, number | null>;
  provenance: Provenance;
  weather: Weather | null;
  household_verdict: Verdict;
  members: MemberAdvice[];
  best_window: TimeWindow | null;
  schedule: ScheduledActivity[];
  indoor: IndoorAdvice | null;
  commute: CommuteAdvice | null;
  hourly: HourlyPoint[];
  station: StationObservation | null;
  station_status: StationStatus;
  explanation: string;
  explanation_source: BriefingSource;
  briefing_id: string | null;
  disclaimer: string;
}

export interface Briefing {
  explanation: string;
  explanation_source: BriefingSource;
}

/** POST /api/plan request body (see PlanRequest in models.py). */
export interface PlanRequest {
  location?: string;
  latitude?: number;
  longitude?: number;
  members: { name: string; groups: string[] }[];
  activities?: {
    label: string;
    activity: string;
    duration_hours: number;
    earliest_hour: number;
    latest_hour: number;
  }[];
  home?: { floor_area_m2: number; ceiling_height_m: number; purifier_cadr_m3h?: number };
  commute?: { distance_km: number; current_mode: string; occupants: number; trips_per_week: number };
  note?: string;
}

/** Raw form values gathered by the planner page before validation. */
export interface FormValues {
  coords: { latitude: number; longitude: number } | null;
  location: string;
  members: { name: string; groups: string[] }[];
  activities: { label: string; activity: string; duration: string; earliest: string; latest: string }[];
  home: { area: string; ceiling: string; cadr: string; unit: string };
  commute: { distance: string; mode: string; occupants: string; trips: string };
  note: string;
}

/** One EPA AQI band, from aqi.CATEGORIES (max is null for the top band). */
export interface Category {
  name: string;
  max: number | null;
  key: string;
  icon: string;
}

/** A form choice: the API value and its short label. */
export interface Choice {
  value: string;
  label: string;
}

/** Constants generated from Python (aegis.frontend); the browser's only copy. */
export interface FrontEndConfig {
  categories: Category[];
  pollutantLabels: Record<string, string>;
  staleAfterHours: number;
  stationRadiusKm: number;
  stationRecentHours: number;
  groups: Choice[];
  activities: Choice[];
  durations: string[];
  modes: Choice[];
}
