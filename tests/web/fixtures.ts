// A complete, typed plan (the shape the API returns) and a fetch stub for component tests.
import { vi } from "vitest";
import type { HourlyPoint, PlanResponse } from "../../web/src/lib/types";

const hourly: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => ({
  time: `2026-11-20T${String(h).padStart(2, "0")}:00`,
  us_aqi: h === 5 ? null : 170 - (h < 12 ? h * 8 : 0),
  pm2_5: h === 5 ? null : 90,
}));

export function makePlan(overrides: Partial<PlanResponse> = {}): PlanResponse {
  return {
    location: "Delhi, Test State",
    aqi: 170,
    category: "Unhealthy",
    dominant_pollutant: "pm2_5",
    pollutants: { pm2_5: 95.2, pm10: 120, o3: null },
    provenance: {
      source: "Open-Meteo",
      model: "CAMS",
      kind: "model_estimate",
      observed_at: "2026-11-20T10:00",
      retrieved_at: "2026-11-20T10:05:00Z",
      data_age_minutes: 5,
      stale: false,
      attribution: "CAMS via Open-Meteo",
      licence_url: "https://open-meteo.com/en/licence",
    },
    weather: {
      wind_speed_kmh: 4,
      boundary_layer_m: 300,
      peak_mixing_time: "2026-11-20T14:00",
      peak_boundary_layer_m: 900,
    },
    household_verdict: "avoid",
    members: [
      {
        name: "You",
        groups: ["asthma"],
        verdict: "avoid",
        reasons: ["US AQI is 170."],
        actions: ["Stay indoors."],
      },
    ],
    best_window: { start: "2026-11-20T10:00", end: "2026-11-20T12:00", mean_aqi: 90, starts_now: false },
    schedule: [
      {
        label: "Walk",
        activity: "walk",
        window: { start: "2026-11-20T10:00", end: "2026-11-20T11:00", mean_aqi: 90, starts_now: false },
        verdict: "caution",
        advice: "Walk at 10:00.",
        inhaled_pm25_ug: 30,
        inhaled_pm25_now_ug: 60,
        exposure_note: "50% less exposure from choosing this time.",
      },
      {
        label: "Run",
        activity: "run",
        window: null,
        verdict: null,
        advice: "Run indoors.",
        inhaled_pm25_ug: null,
        inhaled_pm25_now_ug: null,
        exposure_note: null,
      },
    ],
    indoor: {
      room_volume_m3: 40.5,
      recommended_cadr_m3h: 195,
      purifier_cadr_m3h: 250,
      clean_air_changes_per_hour: 6.2,
      minutes_to_cut_particles_90pct: 22,
      purifier_adequate: true,
      airing_window: null,
      tips: ["Keep windows shut."],
      assumptions: ["Room is sealed."],
    },
    commute: {
      options: [
        {
          mode: "car_petrol",
          label: "Petrol car",
          minutes_per_trip: 19,
          emissions_kg_co2e_per_week: 12.92,
          emissions_avoided_kg_co2e_per_week: 0,
          inhaled_pm25_ug_per_trip: 17.9,
          is_current: true,
        },
        {
          mode: "cycle",
          label: "Bicycle",
          minutes_per_trip: 32,
          emissions_kg_co2e_per_week: 0,
          emissions_avoided_kg_co2e_per_week: 12.92,
          inhaled_pm25_ug_per_trip: 339.5,
          is_current: false,
        },
      ],
      summary: "Cycling avoids 12.92 kg CO2e per week but you breathe in more particles per trip.",
      assumptions: ["Ten trips a week."],
      sources: ["UK DESNZ 2026."],
    },
    hourly,
    station: {
      station_id: 42,
      station_name: "Fixture Road",
      provider: "CPCB",
      is_reference_monitor: true,
      distance_km: 2.4,
      readings: [
        {
          kind: "station_observation",
          station_id: 42,
          provider: "CPCB",
          pollutant: "pm25",
          label: "PM2.5",
          value: 98,
          unit: "µg/m³",
          observed_at: "2026-11-20T09:00",
          retrieved_at: "2026-11-20T10:05",
          data_age_minutes: 65,
          stale: false,
        },
        {
          kind: "station_observation",
          station_id: 42,
          provider: "CPCB",
          pollutant: "co",
          label: "CO",
          value: 0.05,
          unit: "ppm",
          observed_at: null,
          retrieved_at: "2026-11-20T10:05",
          data_age_minutes: null,
          stale: true,
        },
        {
          kind: "station_observation",
          station_id: 42,
          provider: "CPCB",
          pollutant: "no2",
          label: "NO₂",
          value: null,
          unit: "ppb",
          observed_at: null,
          retrieved_at: "2026-11-20T10:05",
          data_age_minutes: null,
          stale: false,
        },
      ],
      attribution: "Measurements by CPCB, via OpenAQ.",
      source: "OpenAQ",
      source_url: "https://openaq.org",
    },
    station_status: "ok",
    explanation: "Rule-based summary.",
    explanation_source: "rules",
    briefing_id: null,
    disclaimer: "General guidance, not medical advice.",
    ...overrides,
  };
}

type Route = (
  url: string,
  init?: RequestInit,
) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>;

/** Replace fetch with a router; returns the mock so tests can inspect calls. */
export function stubFetch(route: Route) {
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    const { status, body } = await route(url, init);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** The JSON body a fetch call was made with. */
export const bodyOf = (init: RequestInit | undefined): unknown => JSON.parse(init?.body as string);
