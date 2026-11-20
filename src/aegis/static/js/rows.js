// Form row mechanics: clone a <template> row, wire unique ids and labels, fill hour pickers.
import { byId, el, pick } from "./dom.js";

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
export function newRow(templateId, prefix) {
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

/**
 * The form control for one field of a row.
 * @param {HTMLLIElement} li
 * @param {string} key
 */
export const field = (li, key) => pick(li, `[data-id=${key}]`);
