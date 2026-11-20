// Pure helpers: categories, text, unit conversion, the request body and error messages.
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  ageText,
  buildPayload,
  categoryFor,
  errorMessage,
  fmt,
  hourLabel,
  toM3h,
} from "../../web/src/lib/format";
import type { FormValues } from "../../web/src/lib/types";

const base: FormValues = {
  coords: null,
  location: "  Delhi ",
  members: [{ name: " ", groups: ["child"] }],
  activities: [
    { label: "Walk", activity: "walk", duration: "1", earliest: "6", latest: "22" },
    { label: " ", activity: "run", duration: "1", earliest: "6", latest: "22" },
  ],
  home: { area: "", ceiling: "2.7", cadr: "", unit: "m3h" },
  commute: { distance: "", mode: "bus", occupants: "1", trips: "10" },
  note: "  ",
};

// The same shape the server renders from aqi.CATEGORIES (the top band has no upper bound).
const BANDS = [
  { name: "Good", max: 50, key: "good", icon: "●" },
  { name: "Moderate", max: 100, key: "moderate", icon: "◆" },
  { name: "Unhealthy for Sensitive Groups", max: 150, key: "usg", icon: "▲" },
  { name: "Unhealthy", max: 200, key: "unhealthy", icon: "■" },
  { name: "Very Unhealthy", max: 300, key: "very-unhealthy", icon: "✖" },
  { name: "Hazardous", max: null, key: "hazardous", icon: "☠" },
];

test("categoryFor maps EPA boundaries and handles missing values", () => {
  assert.equal(categoryFor(50, BANDS)?.key, "good");
  assert.equal(categoryFor(51, BANDS)?.key, "moderate");
  assert.equal(categoryFor(150, BANDS)?.key, "usg");
  assert.equal(categoryFor(301, BANDS)?.key, "hazardous");
  assert.equal(categoryFor(5000, BANDS)?.key, "hazardous");
  assert.equal(categoryFor(null, BANDS), null);
  assert.equal(categoryFor(Number.NaN, BANDS), null);
});

test("text helpers", () => {
  assert.equal(hourLabel("2026-11-19T07:00"), "07:00");
  assert.equal(hourLabel(undefined), "–");
  assert.equal(ageText(0), "just now");
  assert.equal(ageText(45), "45 min ago");
  assert.equal(ageText(200), "3 h 20 min ago");
  assert.equal(fmt(null), "n/a");
  assert.equal(fmt(12.345, 1), "12.3");
});

test("toM3h converts CFM and rejects blanks", () => {
  assert.equal(toM3h("100", "cfm"), 170);
  assert.equal(toM3h("250", "m3h"), 250);
  assert.equal(toM3h("", "m3h"), null);
  assert.equal(toM3h("-5", "m3h"), null);
});

test("buildPayload keeps only filled sections", () => {
  const p = buildPayload(base);
  assert.deepEqual(p.members, [{ name: "You", groups: ["child"] }]);
  assert.equal(p.location, "Delhi");
  assert.deepEqual(
    p.activities?.map((a) => a.duration_hours),
    [1],
  );
  assert.equal("home" in p, false);
  assert.equal("commute" in p, false);
  assert.equal("note" in p, false);
});

test("buildPayload with coordinates, home and commute", () => {
  const p = buildPayload({
    ...base,
    coords: { latitude: 28.6, longitude: 77.2 },
    home: { area: "15", ceiling: "2.5", cadr: "100", unit: "cfm" },
    commute: { distance: "8", mode: "car_petrol", occupants: "2", trips: "10" },
    note: " son has asthma ",
  });
  assert.equal(p.location, undefined);
  assert.equal(p.latitude, 28.6);
  assert.deepEqual(p.home, { floor_area_m2: 15, ceiling_height_m: 2.5, purifier_cadr_m3h: 170 });
  assert.deepEqual(p.commute, {
    distance_km: 8,
    current_mode: "car_petrol",
    occupants: 2,
    trips_per_week: 10,
  });
  assert.equal(p.note, "son has asthma");
});

test("errorMessage is friendly and never dumps raw validation output", () => {
  assert.match(errorMessage(422, { detail: [{ loc: ["x"] }] }), /check the highlighted/);
  assert.match(errorMessage(429, null), /wait a minute/);
  assert.equal(
    errorMessage(404, { detail: "could not find a place called 'X'" }),
    "could not find a place called 'X'",
  );
  assert.match(errorMessage(500, null), /went wrong/);
});
