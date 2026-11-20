// Household and plan rows on the planner form, saved on this device only (localStorage).
import { byId, el, pick } from "./dom.js";

/** @typedef {import("#api").FormValues["members"][number]} MemberRow */
/** @typedef {import("#api").FormValues["activities"][number]} ActivityRow */
/** @typedef {{ location?: string, members?: Partial<MemberRow>[], activities?: Partial<ActivityRow>[] }} Saved */

const STORE_KEY = "aegis.household.v1";
const MAX_MEMBERS = 8;
const MAX_ACTIVITIES = 6;
export const HERE = "My current location";
/** @type {Partial<MemberRow>} */
export const DEFAULT_MEMBER = { name: "You" };
/** @type {ActivityRow} */
export const DEFAULT_ACTIVITY = {
  label: "Walk",
  activity: "walk",
  duration: "1",
  earliest: "6",
  latest: "22",
};
/** @type {(keyof ActivityRow)[]} */
const ACTIVITY_FIELDS = ["label", "activity", "duration", "earliest", "latest"];

const membersList = byId("members");
const activitiesList = byId("activities");
let rowId = 0;
const HOURS_IN_DAY = 24;

/** @param {HTMLSelectElement} select */
function fillHours(select) {
  // API contract: earliest_hour 0-23, latest_hour 1-24.
  const first = select.dataset.id === "latest" ? 1 : 0;
  for (let h = first; h < first + HOURS_IN_DAY; h++) {
    const opt = el("option", `${String(h).padStart(2, "0")}:00`);
    opt.value = String(h);
    select.append(opt);
  }
  select.value = select.dataset.default ?? "";
}

/**
 * Clone a <template> row and give every field a unique id its label points to.
 * @param {string} templateId
 * @param {string} prefix
 * @returns {HTMLLIElement}
 */
function newRow(templateId, prefix) {
  const template = /** @type {HTMLTemplateElement} */ (byId(templateId));
  const li = /** @type {HTMLLIElement} */ (template.content.firstElementChild?.cloneNode(true));
  const id = `${prefix}-${rowId++}`;
  li.querySelectorAll("[data-id]").forEach((input) => {
    input.id = `${id}-${/** @type {HTMLElement} */ (input).dataset.id}`;
  });
  li.querySelectorAll("label[data-for]").forEach((label) => {
    const l = /** @type {HTMLLabelElement} */ (label);
    l.htmlFor = `${id}-${l.dataset.for}`;
  });
  li.querySelectorAll("select.hour").forEach((s) => fillHours(/** @type {HTMLSelectElement} */ (s)));
  return li;
}

/** @param {HTMLLIElement} li @param {string} key */
const field = (li, key) => pick(li, `[data-id=${key}]`);

// The last person cannot be removed: a plan always has someone in it.
function syncRemoveButtons() {
  const only = membersList.children.length === 1;
  membersList.querySelectorAll(".remove").forEach((b) => {
    /** @type {HTMLElement} */ (b).hidden = only;
  });
}

/**
 * Remove a row and move focus to its neighbour (or the add button), never to <body>.
 * @param {HTMLLIElement} li
 * @param {HTMLElement} parent
 */
function removeRow(li, parent) {
  const next = li.nextElementSibling || li.previousElementSibling;
  li.remove();
  syncRemoveButtons();
  /** @type {HTMLElement | null} */ (
    next?.querySelector("input, select") || parent.nextElementSibling
  )?.focus();
}

/**
 * @param {Partial<MemberRow>} [data]
 * @returns {HTMLLIElement | null} the new row, or null at the limit
 */
export function addMember(data = {}) {
  if (membersList.children.length >= MAX_MEMBERS) return null;
  const li = newRow("member-tpl", "m");
  field(li, "name").value = data.name || "";
  (data.groups || []).forEach((g) => {
    const box = li.querySelector(`input[type=checkbox][value="${CSS.escape(g)}"]`);
    if (box) /** @type {HTMLInputElement} */ (box).checked = true;
  });
  pick(li, ".remove").addEventListener("click", () => removeRow(li, membersList));
  membersList.append(li);
  syncRemoveButtons();
  return li;
}

/**
 * @param {Partial<ActivityRow>} [data]
 * @returns {HTMLLIElement | null} the new row, or null at the limit
 */
export function addActivity(data = {}) {
  if (activitiesList.children.length >= MAX_ACTIVITIES) return null;
  const li = newRow("activity-tpl", "a");
  ACTIVITY_FIELDS.forEach((key) => {
    const value = data[key];
    if (value !== undefined) field(li, key).value = value;
  });
  pick(li, ".remove").addEventListener("click", () => removeRow(li, activitiesList));
  activitiesList.append(li);
  return li;
}

/** @returns {MemberRow[]} */
export function readMembers() {
  return [...membersList.children].map((row) => {
    const li = /** @type {HTMLLIElement} */ (row);
    return {
      name: field(li, "name").value,
      groups: [...li.querySelectorAll("input[type=checkbox]:checked")].map(
        (c) => /** @type {HTMLInputElement} */ (c).value,
      ),
    };
  });
}

/** @returns {ActivityRow[]} */
export function readActivities() {
  return [...activitiesList.children].map((row) => {
    const li = /** @type {HTMLLIElement} */ (row);
    return /** @type {ActivityRow} */ (
      Object.fromEntries(ACTIVITY_FIELDS.map((key) => [key, field(li, key).value]))
    );
  });
}

/** @param {string} location */
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
  membersList.replaceChildren();
  activitiesList.replaceChildren();
  addMember(DEFAULT_MEMBER);
  addActivity(DEFAULT_ACTIVITY);
}
