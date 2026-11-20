// Network layer: the two JSON endpoints the pages call. No DOM, no React.
import type { Briefing, PlanRequest, PlanResponse } from "./types";

export interface PlanResult {
  ok: boolean;
  status: number;
  data: unknown;
}

/** POST the plan request; the body is parsed even on errors so the detail can be shown. */
export async function postPlan(body: PlanRequest): Promise<PlanResult> {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

/** The plan from a successful result; the server's response model guarantees its shape. */
export const planOf = (result: PlanResult): PlanResponse | null =>
  result.ok && result.data ? (result.data as PlanResponse) : null;

/** Ask for the single-use AI briefing; null when it expired or failed. */
export async function postBriefing(id: string): Promise<Briefing | null> {
  const response = await fetch(`/api/briefing/${encodeURIComponent(id)}`, { method: "POST" });
  return response.ok ? ((await response.json()) as Briefing) : null;
}
