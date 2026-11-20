// Briefing card: the plain-language summary and where it came from.
import { card, el } from "../dom.js";

/** @typedef {import("#api").PlanResponse} PlanResponse */

/** @type {Record<"gemini" | "rules" | "pending", string>} */
export const SOURCE_TEXT = {
  gemini: "Written by Google Gemini from the computed plan; it cannot change verdicts or numbers.",
  rules: "Rule-based briefing.",
  pending: "Rule-based briefing; asking Google Gemini for a personalised version…",
};

/**
 * The rule-based briefing, marked "pending" while the AI version is requested.
 * @param {PlanResponse} d
 */
export function renderBriefing(d) {
  const section = card("Your briefing", "briefing");
  section.append(
    el("p", d.explanation, "lead briefing-text"),
    el("p", SOURCE_TEXT[d.briefing_id ? "pending" : d.explanation_source], "help briefing-source"),
  );
  return section;
}
