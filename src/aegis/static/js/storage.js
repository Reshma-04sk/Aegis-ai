// Saved household on this device only (localStorage); nothing is sent anywhere else.
import {
  DEFAULT_ACTIVITY,
  DEFAULT_MEMBER,
  HERE,
  MAX_ACTIVITIES,
  MAX_MEMBERS,
  addActivity,
  addMember,
  clearRows,
  readActivities,
  readMembers,
} from "./household.js";

/** @typedef {import("#api").FormValues["members"][number]} MemberRow */
/** @typedef {import("#api").FormValues["activities"][number]} ActivityRow */
/** @typedef {{ location?: string, members?: Partial<MemberRow>[], activities?: Partial<ActivityRow>[] }} Saved */

const STORE_KEY = "aegis.household.v1";

/**
 * Remember the household and place for the next visit.
 * @param {string} location
 */
export function save(location) {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ location, members: readMembers(), activities: readActivities() }),
    );
  } catch {
    /* storage unavailable (private mode): the plan still works */
  }
}

/** @returns {Saved} */
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") ?? {};
  } catch {
    return {};
  }
}

/**
 * @template T
 * @param {T[] | undefined} value
 * @param {T} fallback
 * @returns {T[]}
 */
const nonEmpty = (value, fallback) => (Array.isArray(value) && value.length ? value : [fallback]);

/**
 * Restore the saved household. A city from the landing page (/plan?city=Delhi) wins over the saved one.
 * @param {HTMLInputElement} locationInput
 */
export function restore(locationInput) {
  const saved = load();
  if (saved.location && saved.location !== HERE) locationInput.value = saved.location;
  const city = new URLSearchParams(window.location.search).get("city")?.trim();
  if (city) locationInput.value = city.slice(0, 100);
  nonEmpty(saved.members, DEFAULT_MEMBER)
    .slice(0, MAX_MEMBERS)
    .forEach((m) => addMember(m));
  nonEmpty(saved.activities, DEFAULT_ACTIVITY)
    .slice(0, MAX_ACTIVITIES)
    .forEach((a) => addActivity(a));
}

/** Delete the saved household and reset the form to one person and one walk. */
export function forget() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* nothing stored */
  }
  clearRows();
  addMember(DEFAULT_MEMBER);
  addActivity(DEFAULT_ACTIVITY);
}
