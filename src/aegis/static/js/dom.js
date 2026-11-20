// Safe DOM builders shared by both pages. Text goes in via textContent only (never innerHTML),
// so provider or user data can never inject markup.
import { VERDICTS } from "./format.js";
import { categoryOf } from "./config.js";

/** @typedef {import("#api").Verdict} Verdict */

const SVG_NS = "http://www.w3.org/2000/svg";
let headingId = 0;

/**
 * Create an element with optional text and class.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {string | null} [text]
 * @param {string} [className]
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/**
 * @param {string[]} items
 * @param {string} [className]
 */
export function list(items, className) {
  const ul = el("ul", undefined, className);
  items.forEach((item) => ul.append(el("li", item)));
  return ul;
}

/**
 * Create an SVG element with attributes.
 * @template {keyof SVGElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, string | number>} [attrs]
 * @returns {SVGElementTagNameMap[K]}
 */
export function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

// A results card: a <section> labelled by its own heading.
/**
 * @param {string} title
 * @param {string} [className]
 */
export function card(title, className) {
  const section = el("section", undefined, `card ${className || ""}`.trim());
  const heading = el("h2", title);
  heading.id = `h-${headingId++}`;
  section.setAttribute("aria-labelledby", heading.id);
  section.append(heading);
  return section;
}

// Never colour alone: every badge carries an icon (hidden from screen readers) and a text label.
/**
 * @param {string} className
 * @param {string} icon
 * @param {string} label
 */
function badge(className, icon, label) {
  const node = el("span", undefined, `badge ${className}`);
  const mark = el("span", `${icon} `);
  mark.setAttribute("aria-hidden", "true");
  node.append(mark, document.createTextNode(label));
  return node;
}

/** @param {Verdict} verdict */
export function verdictBadge(verdict) {
  const v = VERDICTS[verdict];
  return badge(`verdict-${verdict}`, v.icon, v.label);
}

/** @param {number} aqi */
export function categoryBadge(aqi) {
  const c = categoryOf(aqi);
  if (!c) return el("span", "AQI unknown", "badge");
  return badge(`cat-${c.key}`, c.icon, c.name);
}

/**
 * Element by id. A missing element is a page bug, so this throws instead of returning null.
 * @template {HTMLElement} [T=HTMLElement]
 * @param {string} id
 * @returns {T}
 */
export function byId(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} is missing from the page`);
  return /** @type {T} */ (node);
}

/**
 * First descendant matching a selector the markup guarantees (template rows, results).
 * @template {Element} [T=HTMLInputElement]
 * @param {ParentNode} root
 * @param {string} selector
 * @returns {T}
 */
export function pick(root, selector) {
  const node = root.querySelector(selector);
  if (!node) throw new Error(`${selector} is missing`);
  return /** @type {T} */ (node);
}

/**
 * A table header cell with attributes (scope, rowspan, colspan).
 * @param {string} text
 * @param {Record<string, string>} attrs
 */
export function th(text, attrs) {
  const cell = el("th", text);
  Object.entries(attrs).forEach(([key, value]) => cell.setAttribute(key, value));
  return cell;
}
