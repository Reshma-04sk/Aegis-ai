# ADR 0002: Forecast and measurement stay separate

**Status:** accepted

## Context
AEGIS uses two kinds of air data:
- the Copernicus CAMS forecast (via Open-Meteo), available for every place and hour;
- station observations (CPCB, AirNow and others, via OpenAQ), which are real measurements but
  sparse, sometimes stale, and reported in mixed units.

Blending them, for example "correcting" the forecast with a station reading, would produce a
number that is neither measured nor modelled, with no honest provenance.

## Decision
- Model estimates (`kind: model_estimate`) and station observations
  (`kind: station_observation`) are separate Pydantic models with separate provenance: source,
  retrieved and observed times, data age, and a stale flag after 180 minutes.
- Decisions use the forecast, because it covers every hour needed for planning. Station readings
  are shown beside it, labelled, with distance, provider and age, and are never merged into it.
- Units are passed through as the provider reports them (µg/m³, ppb, ppm). Missing, non-finite
  or negative station values stay missing, and a future-dated reading is shown as stale with an
  unknown age.

## Consequences
- Users can see when the model and the nearest monitor disagree, which is itself useful
  information.
- `test_api.py::test_station_observation_is_separate_from_model_estimate` guards the boundary.
