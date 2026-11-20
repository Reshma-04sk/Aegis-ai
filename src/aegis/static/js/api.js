// Network layer: the two JSON endpoints the planner calls. No DOM here.

/** @typedef {import("#api").PlanResponse} PlanResponse */
/** @typedef {import("#api").Briefing} Briefing */

/**
 * POST the plan request; the body is parsed even on errors so the detail can be shown.
 * @param {object} body
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
export async function postPlan(body) {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

/**
 * Ask for the single-use AI briefing; null when it expired or failed.
 * @param {string} id
 * @returns {Promise<Briefing | null>}
 */
export async function postBriefing(id) {
  const response = await fetch(`/api/briefing/${encodeURIComponent(id)}`, { method: "POST" });
  return response.ok ? response.json() : null;
}
