# AEGIS API

Base URL: the deployed app root. All bodies are JSON. Pydantic models in
[`src/aegis/models.py`](../src/aegis/models.py) are the contract: unknown fields are rejected
(`422`), and every number has bounds.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness: `{"status": "ok"}` |
| `POST` | `/api/plan` | Deterministic household plan plus a rule-based briefing |
| `POST` | `/api/briefing/{briefing_id}` | One-time Gemini rewrite of that plan's briefing (expires after 5 min) |

API responses carry `Cache-Control: no-store` and `X-Request-ID`. Responses over 1 KB are gzipped.

## POST /api/plan

Only a location (or `latitude` + `longitude`) is required.

| Field | Type | Limits |
|---|---|---|
| `location` | string | place name, geocoded via Open-Meteo |
| `latitude`, `longitude` | number | both or neither; −90..90, −180..180 |
| `members[]` | `{name, groups[]}` | 1–8 members; groups: `asthma`, `child`, `elderly`, `pregnant`, `heart_condition` |
| `activities[]` | `{label, activity, duration_hours, earliest_hour, latest_hour}` | ≤ 6; activity: `rest`, `walk`, `commute`, `cycle`, `run`; 0.25–8 h; hours 0–23 / 1–24 |
| `home` | `{floor_area_m2, ceiling_height_m, purifier_cadr_m3h}` | 4–200 m², 2–5 m, CADR 0–3000 m³/h or `null` |
| `commute` | `{distance_km, current_mode, occupants, trips_per_week}` | one-way 0–100 km; modes: `car_petrol`, `car_diesel`, `car_hybrid`, `car_ev`, `motorbike`, `taxi`, `bus`, `metro`, `rail`, `cycle`, `walk` |
| `note` | string | ≤ 300 chars, untrusted; parsed for hints, passed to Gemini as data |

Request:

```json
{
    "location": "Delhi",
    "members": [
        {
            "name": "Asha",
            "groups": [
                "asthma"
            ]
        }
    ],
    "activities": [
        {
            "label": "Evening walk",
            "activity": "walk",
            "duration_hours": 1,
            "earliest_hour": 16,
            "latest_hour": 21
        }
    ],
    "home": {
        "floor_area_m2": 15,
        "purifier_cadr_m3h": 250
    },
    "commute": {
        "distance_km": 8,
        "current_mode": "car_petrol"
    }
}
```

Response (real output, trimmed: `hourly` has 24 points and `commute.options` lists every mode,
cleanest first):

```json
{
  "location": "Delhi, National Capital Territory of Delhi, India",
  "aqi": 171.0,
  "category": "Unhealthy",
  "dominant_pollutant": "pm2_5",
  "pollutants": {
    "pm2_5": 146.7,
    "pm10": 147.1,
    "nitrogen_dioxide": 108.9,
    "ozone": 21.0,
    "sulphur_dioxide": 67.6,
    "carbon_monoxide": 3192.0
  },
  "provenance": {
    "source": "Open-Meteo Air Quality API",
    "model": "CAMS (Copernicus Atmosphere Monitoring Service) forecast",
    "kind": "model_estimate",
    "observed_at": "2026-11-19T20:30",
    "retrieved_at": "2026-11-19T15:30:31Z",
    "data_age_minutes": 30,
    "stale": false,
    "attribution": "Air quality data by Open-Meteo.com (CC BY 4.0), based on Copernicus CAMS",
    "licence_url": "https://open-meteo.com/en/licence"
  },
  "weather": {
    "wind_speed_kmh": 1.0,
    "boundary_layer_m": 15.0,
    "peak_mixing_time": "2026-11-20T14:00",
    "peak_boundary_layer_m": 670.0
  },
  "household_verdict": "avoid",
  "members": [
    {
      "name": "Asha",
      "groups": [
        "asthma"
      ],
      "verdict": "avoid",
      "reasons": [
        "US AQI is 171 (Unhealthy).",
        "PM2.5 is the main pollutant.",
        "Sensitive-group guidance applies (asthma or a lung condition)."
      ],
      "actions": [
        "Stay indoors with windows closed and a purifier running if you have one.",
        "Skip outdoor exercise; if you must go out, wear a well-fitted N95/FFP2 mask.",
        "Keep the reliever inhaler at hand and follow the asthma action plan.",
        "Fine particles pass through cloth masks; an N95/FFP2 is the effective option.",
        "For chest pain, severe breathlessness or wheezing, seek medical help or follow your local health authority's guidance."
      ]
    }
  ],
  "best_window": {
    "start": "2026-11-19T20:00",
    "end": "2026-11-19T22:00",
    "mean_aqi": 172.0,
    "starts_now": true
  },
  "schedule": [
    {
      "label": "Evening walk",
      "activity": "walk",
      "window": {
        "start": "2026-11-19T20:00",
        "end": "2026-11-19T21:00",
        "mean_aqi": 171.0,
        "starts_now": true
      },
      "verdict": "avoid",
      "advice": "Air stays poor all day; do an indoor alternative instead.",
      "inhaled_pm25_ug": 237.7,
      "inhaled_pm25_now_ug": 237.7,
      "exposure_note": "You would breathe in about 237.7 µg of PM2.5 in this slot."
    }
  ],
  "indoor": {
    "room_volume_m3": 40.5,
    "recommended_cadr_m3h": 197.0,
    "purifier_cadr_m3h": 250.0,
    "clean_air_changes_per_hour": 6.2,
    "minutes_to_cut_particles_90pct": 22,
    "purifier_adequate": true,
    "airing_window": {
      "start": "2026-11-19T20:00",
      "end": "2026-11-19T21:00",
      "mean_aqi": 171.0,
      "starts_now": true
    },
    "tips": [
      "Keep airing short today: outdoor air is not forecast to improve much.",
      "Keep windows and doors shut while outdoor air is poor; seal obvious gaps.",
      "Run the purifier on high in the room where people sleep, door closed.",
      "No purifier? A box fan with a MERV 13 filter taped to its intake is a low-cost option.",
      "Avoid burning incense, candles, mosquito coils, wood or coal indoors.",
      "Use the kitchen exhaust (or open a window briefly) while frying or grilling.",
      "Damp-dust and wet-mop instead of sweeping, which lifts settled particles."
    ],
    "assumptions": [
      "Well-mixed room with doors and windows closed.",
      "Purifier CADR is the manufacturer's smoke/particle rating.",
      "Real results vary with filter condition, placement, leaks and indoor sources.",
      "No indoor sensor is used: these are estimates, not measurements."
    ]
  },
  "commute": {
    "options": [
      {
        "mode": "cycle",
        "label": "Bicycle",
        "minutes_per_trip": 32,
        "emissions_kg_co2e_per_week": 0.0,
        "emissions_avoided_kg_co2e_per_week": 12.92,
        "inhaled_pm25_ug_per_trip": 230.0,
        "is_current": false
      },
      {
        "mode": "metro",
        "label": "Metro / tram",
        "minutes_per_trip": 15,
        "emissions_kg_co2e_per_week": 1.7,
        "emissions_avoided_kg_co2e_per_week": 11.22,
        "inhaled_pm25_ug_per_trip": 9.2,
        "is_current": false
      }
    ],
    "summary": "Switching from petrol car to bicycle avoids about 12.92 kg CO2e per week. Note: at today's PM2.5 you would breathe in more particles per trip (230 vs 12.1 µg), so pick quieter routes and cleaner hours, or switch on cleaner days.",
    "assumptions": [
      "Emission factors are UK averages; local vehicle fleets and power grids differ (an electric car charged on a coal-heavy grid emits more than shown).",
      "Metro uses the DESNZ 'Light rail and tram' factor; suburban rail uses 'National rail'.",
      "Speeds are typical urban door-to-door averages, not route-specific.",
      "Inhaled PM2.5 assumes in-vehicle air equals today's modelled outdoor PM2.5; real cabin filtration and roadside levels vary.",
      "Walking counted as moderate intensity, cycling as high intensity, motorbike as light."
    ],
    "sources": [
      "UK DESNZ Greenhouse gas reporting: conversion factors 2026 (Business travel- land)",
      "US EPA Exposure Factors Handbook 2011, Chapter 6, Table 6-2"
    ]
  },
  "hourly": [
    {
      "time": "2026-11-19T20:00",
      "us_aqi": 171.0,
      "pm2_5": 146.7
    },
    {
      "time": "2026-11-19T21:00",
      "us_aqi": 173.0,
      "pm2_5": 151.3
    }
  ],
  "explanation": "It is best for your household to stay indoors as much as possible today. US AQI is 171 (Unhealthy). Keep airing short today: outdoor air is not forecast to improve much. Switching from petrol car to bicycle avoids about 12.92 kg CO2e per week. Note: at today's PM2.5 you would breathe in more particles per trip (230 vs 12.1 µg), so pick quieter routes and cleaner hours, or switch on cleaner days.",
  "explanation_source": "rules",
  "briefing_id": "<one-time id>",
  "disclaimer": "General guidance from modelled public air-quality data, not medical advice. Follow your doctor's plan and your local health authority's alerts."
}
```

Notes on the fields:
- `aqi` is the US EPA AQI. `pollutants` are concentrations in µg/m³. Missing values are `null`,
  never estimated.
- `provenance.kind` is always `model_estimate` (CAMS forecast, not a station reading).
  `stale` is `true` when `data_age_minutes` > 180.
- `schedule[].inhaled_pm25_ug` is the PM2.5 breathed in during the chosen slot, and
  `inhaled_pm25_now_ug` is the same activity started now: the impact of choosing that time.
  Both are `null` if any hourly PM2.5 value is missing.
- `station` is the nearest OpenAQ station reading (`kind: station_observation`), or `null`.
  `station_status` says why: `ok`, `not_configured` (no `OPENAQ_API_KEY`), `none_nearby`
  (nothing within 25 km reported in 24 h) or `unavailable` (OpenAQ error or malformed data).
  Only reference monitors are searched; readings over a day old are left out; units are the
  provider's own. Example:

  ```json
  "station": {
    "station_id": 42, "station_name": "Fixture Road", "provider": "CPCB",
    "is_reference_monitor": true, "distance_km": 2.4,
    "readings": [
      {"kind": "station_observation", "station_id": 42, "provider": "CPCB",
       "pollutant": "pm25", "label": "PM2.5", "value": 98.0, "unit": "µg/m³",
       "observed_at": "2026-11-19T15:00:00Z", "retrieved_at": "2026-11-19T15:30:00Z",
       "data_age_minutes": 30, "stale": false}
    ],
    "attribution": "Measurements by Central Pollution Control Board, via OpenAQ (openaq.org).",
    "source": "OpenAQ", "source_url": "https://openaq.org"
  },
  "station_status": "ok"
  ```
  (Example values come from the test fixture, not a live call.)
- `emissions_*_kg_co2e_per_week` (macro impact) and `inhaled_pm25_ug_per_trip` (personal exposure)
  are separate fields. One is never derived from the other.
- `explanation_source` is `rules` here; the upgraded briefing comes from the endpoint below.

## POST /api/briefing/{briefing_id}

No body. Returns the AI briefing for the plan that issued `briefing_id`. Each id works once.

```json
{
  "explanation": "Today's air quality is currently in the unhealthy range, so the household verdict is to avoid outdoor activities. …",
  "explanation_source": "gemini"
}
```

If there is no API key, Gemini fails (one retry on 429/5xx) or runs past the 25 s budget, or its output fails validation (JSON,
≤ 700 chars, no links), the response is the rule-based text with `"explanation_source": "rules"`.

## Errors

| Status | When | Body |
|---|---|---|
| `404` | place not found, or briefing id unknown/expired/used | `{"detail": "could not find a place called 'Qzxqzxv'"}` |
| `422` | validation failed (unknown field, out of range) | FastAPI validation detail |
| `429` | rate limit exceeded (per client, per minute) | `{"detail": "too many requests, please slow down"}` + `Retry-After` |
| `502` | air-quality service unavailable | `{"detail": "The air-quality forecast service did not respond. Please try again in a minute."}` |
