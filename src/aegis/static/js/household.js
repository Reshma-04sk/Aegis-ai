// Household members and planned activities on the planner form: add, remove and read rows.
import { byId, pick } from "./dom.js";
import { field, newRow } from "./rows.js";

/** @typedef {import("#api").FormValues["members"][number]} MemberRow */
/** @typedef {import("#api").FormValues["activities"][number]} ActivityRow */

export const MAX_MEMBERS = 8;
export const MAX_ACTIVITIES = 6;
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

/** Empty both lists (used when the saved household is forgotten). */
export function clearRows() {
  membersList.replaceChildren();
  activitiesList.replaceChildren();
}
