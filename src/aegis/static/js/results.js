// Results region: messages, the rendered plan, and the AI briefing upgrade.
import { postBriefing } from "./api.js";
import { byId, el, pick } from "./dom.js";
import { SOURCE_TEXT } from "./cards/briefing.js";
import { renderPlan } from "./render.js";

const results = byId("results");

/**
 * Replace the results with one message (an alert by default).
 * @param {string} text
 * @param {"alert" | "status"} [role]
 * @param {string} [className]
 */
export function showMessage(text, role = "alert", className = "error") {
  const p = el("p", text, className);
  p.setAttribute("role", role);
  results.replaceChildren(p);
}

/**
 * The plan arrives with a rule-based briefing; swap in Gemini's version if it comes back.
 * @param {string} id
 */
async function upgradeBriefing(id) {
  // Hold this plan's nodes: a newer plan must never receive an older plan's briefing.
  const text = pick(results, ".briefing-text");
  const source = pick(results, ".briefing-source");
  const data = await postBriefing(id).catch(() => null);
  if (!source.isConnected) return;
  const fromGemini = data?.explanation_source === "gemini";
  if (data && fromGemini) text.textContent = data.explanation;
  source.textContent = SOURCE_TEXT[fromGemini ? "gemini" : "rules"];
}

/**
 * Show the plan, move focus to it and start the briefing upgrade.
 * @param {import("#api").PlanResponse} d
 */
export function showPlan(d) {
  results.replaceChildren(...renderPlan(d));
  results.focus({ preventScroll: true });
  // motion.js glides to the results when smooth scrolling is on; otherwise jump there.
  if (!document.documentElement.classList.contains("lenis")) results.scrollIntoView({ block: "start" });
  document.dispatchEvent(new CustomEvent("aegis:results", { detail: { aqi: d.aqi } }));
  if (d.briefing_id) upgradeBriefing(d.briefing_id);
}

/**
 * Loading state on the submit button and the results region.
 * @param {boolean} busy
 */
export function setBusy(busy) {
  const button = /** @type {HTMLButtonElement} */ (byId("submit-btn"));
  button.disabled = busy;
  button.classList.toggle("is-loading", busy);
  results.setAttribute("aria-busy", String(busy));
  if (busy) results.replaceChildren(el("p", "Building your plan…", "help"));
}
