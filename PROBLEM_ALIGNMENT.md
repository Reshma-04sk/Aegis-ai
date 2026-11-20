# Problem statement alignment

**Challenge:** PromptWars Virtual, Challenge 6: *Urban Air Quality Assistant*. A GenAI assistant
that helps families in smog-affected cities protect their health day to day.

**AEGIS's answer:** a single number like "AQI 172" tells nobody what to do. AEGIS turns live
air data into **one plan for the whole household**: who should go out and when, how to keep the
air at home clean, and what a greener commute changes. Every number shows its source and age.

## Who it serves
Households in smog-affected cities, especially those with someone sensitive: asthma or a lung
condition, children, older adults, pregnancy or a heart condition. The household follows its
strictest member's verdict.

## Requirements traceability matrix

Each requirement maps to the code that implements it and the tests that prove it. Every listed
test runs in CI on every push.

| ID | Requirement | Implementation | Verified by |
|---|---|---|---|
| R1 | Live air quality for any city or the user's location | `airdata/openmeteo.py` (`OpenMeteoClient.snapshot`: geocoding, CAMS forecast, weather) | `test_airdata.py::test_snapshot_by_name_geocodes_then_caches`, `test_api.py::test_coordinates_accepted` |
| R2 | Measured readings from the nearest monitoring station, next to the forecast | `stations/openaq.py` (`OpenAQClient.nearest`: CPCB, AirNow and others via OpenAQ v3) | `test_stations.py` (28 tests), `test_api.py::test_station_observation_is_separate_from_model_estimate` |
| R3 | Health guidance per person, stricter for sensitive groups | `rules/verdict.py` (`verdict_for`: EPA category ladders), `rules/advice/` (reason and action registries) | `test_rules.py::test_verdict_matrix`, `::test_same_air_differs_by_person` |
| R4 | Understands people described in plain words ("my son has asthma") | `profiles.py` (`extract_from_note`: keyword and negation-aware note parsing) | `test_profiles.py` (8 tests incl. `::test_negation_is_respected`) |
| R5 | Low-exposure daily routine: each activity in its cleanest hours | `rules/window.py` (`cleanest_window`), `planner/schedule.py` (`plan_day`) | `test_planner.py::test_activities_get_distinct_clean_slots_in_input_order`, `test_rules.py::test_cleanest_window_crosses_midnight_and_avoids_taken` |
| R6 | Show the personal benefit of the chosen time (PM2.5 dose) | `planner/dose.py` (`inhaled_pm25`, `exposure_note`), `exposure.py` (EPA inhalation rates) | `test_planner.py::test_choice_impact_is_personal_exposure_vs_going_now` |
| R7 | Honest when no time is safe | `planner/schedule.py` (indoor alternative when the best window is still poor) | `test_planner.py::test_unfittable_activity_reported`, e2e "household plan shows verdicts…" |
| R8 | Indoor air: purifier sizing, air changes, when to air the home | `indoor.py` (EPA CADR chart, ACH, 90% clean-down time, airing window) | `test_indoor.py` (6 tests) |
| R9 | Greener commute with its impact | `commute/factors.py` (UK DESNZ 2026 factors, carpooling), `commute/compare.py` | `test_commute.py::test_emissions_and_avoided_are_consistent` |
| R10 | Climate impact kept separate from personal exposure | `models/advice.py` (`ModeOption`: separate CO2e and µg fields), `exposure.py` vs `commute/factors.py`, `static/js/cards/impact.js` (two-level table header) | `test_commute.py::test_exposure_is_separate_and_can_rise_when_emissions_fall` |
| R11 | Plain-language AI briefing grounded only in computed facts | `advisor/gemini.py` (`GeminiAdvisor`, JSON output), `advisor/facts.py` (`plan_facts`), `advisor/briefing.py` (rule fallback) | `test_advisor.py` (21 tests), `test_api.py::test_prompt_injection_cannot_change_verdict` |
| R12 | Data age everywhere; stale after 3 hours | `freshness.py` (`STALE_AFTER_MINUTES = 180`), `airdata/parse.py`, `stations/observation.py`, `static/js/cards/overview.js`, `cards/station.js` | `test_airdata.py::test_provenance_age_and_staleness`, `test_stations.py::test_invalid_values_stay_missing_and_old_readings_are_stale` |
| R13 | Never invent data: missing stays missing | `airdata/parse.py` (`_num`), `stations/values.py` (`measured_value` rejects NaN, infinity, negatives, booleans) | `test_airdata.py::test_parse_uses_current_hour_and_keeps_missing_values`, `test_stations.py::test_non_finite_or_non_numeric_values_stay_missing` |
| R14 | No medical claims; point to official guidance | `rules/advice/actions.py` (`urgent_help`), `models/plan.py` (disclaimer) | `test_rules.py::test_avoid_points_to_health_authority_without_diagnosis` |
| R15 | Usable by everyone (WCAG 2.1 AA, keyboard, reduced motion) | Semantic HTML, `dom.js` badges (icon + text, never colour alone) | 28 Playwright tests with axe at 1440 px and 375 px; see [ACCESSIBILITY.md](ACCESSIBILITY.md) |
| R16 | Private by default | Household kept in `localStorage` only; coordinates rounded to 3 decimals; nothing persisted server-side | `static/js/storage.js`, `location.js`; see [SECURITY.md](SECURITY.md) |

## Design rules that keep the answers trustworthy
- **Rules decide, AI explains** ([ADR 0001](docs/adr/0001-rules-decide-ai-explains.md)). Verdicts,
  times and numbers come from deterministic code. Gemini only words them, and its output cannot
  change them.
- **Forecast and measurement are never mixed** ([ADR 0002](docs/adr/0002-forecast-and-measurement-stay-separate.md)).
  CAMS model estimates and station observations are separate objects with their own provenance.
- **EPA AQI and WHO guideline values are never presented as each other.**

## Out of scope, on purpose
Medical diagnosis or treatment, accounts or server-side personal data, and push alerts. Each
would add risk or collect data without making the daily plan better.
