// The saved household, on this device only (localStorage); nothing is sent anywhere else.
// Saved values are untrusted input: each field is type-checked and length-capped on the way in.
import { blankHousehold, HERE, MAX_ACTIVITIES, MAX_MEMBERS } from "./household";
import type { ActivityRow, Household, MemberRow } from "./household";

const STORE_KEY = "aegis.household.v1";
const MAX_TEXT = 100;

const text = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value.slice(0, MAX_TEXT) : fallback;

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    : [];

/** Remember the place, people and plans for the next visit (best effort). */
export function save(h: Household): void {
  const members = h.members.map(({ name, groups }) => ({ name, groups }));
  const activities = h.activities.map(({ label, activity, duration, earliest, latest }) => ({
    label,
    activity,
    duration,
    earliest,
    latest,
  }));
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ location: h.place, members, activities }));
  } catch {
    // Storage unavailable (private mode or full): the plan still works.
  }
}

/** Delete the saved household. */
export function forget(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // Nothing stored.
  }
}

function load(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function membersFrom(saved: unknown, firstKey: number): MemberRow[] {
  return records(saved)
    .slice(0, MAX_MEMBERS)
    .map((m, i) => ({
      name: text(m.name, ""),
      groups: Array.isArray(m.groups) ? m.groups.filter((g): g is string => typeof g === "string") : [],
      key: firstKey + i,
    }));
}

function activitiesFrom(saved: unknown, firstKey: number): ActivityRow[] {
  return records(saved)
    .slice(0, MAX_ACTIVITIES)
    .map((a, i) => ({
      label: text(a.label, ""),
      activity: text(a.activity, "walk"),
      duration: text(a.duration, "1"),
      earliest: text(a.earliest, "6"),
      latest: text(a.latest, "22"),
      key: firstKey + i,
    }));
}

/** A city passed from the landing page (/plan?city=Delhi) wins over the saved place. */
function startingPlace(saved: Record<string, unknown>): string {
  const city = new URLSearchParams(window.location.search).get("city")?.trim().slice(0, MAX_TEXT);
  if (city) return city;
  const place = text(saved.location, "");
  return place === HERE ? "" : place; // device coordinates are never saved, so neither is "here"
}

/** The household to start from: the saved one, if any. On the server: a blank household. */
export function initialHousehold(): Household {
  if (typeof window === "undefined") return blankHousehold();
  const saved = load();
  const blank = blankHousehold(startingPlace(saved));
  const members = membersFrom(saved.members, blank.nextKey);
  const activities = activitiesFrom(saved.activities, blank.nextKey + members.length);
  return {
    ...blank,
    members: members.length ? members : blank.members,
    activities: activities.length ? activities : blank.activities,
    nextKey: blank.nextKey + members.length + activities.length,
  };
}
