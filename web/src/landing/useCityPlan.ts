// The landing page's data: one city's plan from POST /api/plan, reused for a few minutes.
// A newer city choice always wins over a slower earlier request, and a failed city never leaves
// another city's numbers on screen.
import { useCallback, useEffect, useRef, useState } from "react";
import { planOf, postPlan } from "../lib/api";
import type { PlanResponse } from "../lib/types";

export const CITIES = ["Delhi", "Mumbai", "Kolkata", "Bengaluru", "Chennai"] as const;

export type CityState =
  | { city: string; status: "loading"; plan: null }
  | { city: string; status: "ready"; plan: PlanResponse }
  | { city: string; status: "error"; plan: null };

// A plan's data age and stale flag were computed when it was fetched, so a cached plan is only
// reused briefly (the server's own forecast cache lasts 10 minutes); then it is fetched again.
const REUSE_MS = 300_000; // five minutes
const cache = new Map<string, { plan: Promise<PlanResponse>; at: number }>();

async function fetchPlan(city: string): Promise<PlanResponse> {
  const plan = planOf(await postPlan({ location: city, members: [{ name: "You", groups: [] }] }));
  if (!plan) throw new Error(`no plan for ${city}`);
  return plan;
}

/** The city's plan, reused for five minutes; a failed request is forgotten so a retry refetches. */
export function planFor(city: string, now = Date.now()): Promise<PlanResponse> {
  const cached = cache.get(city);
  if (cached && now - cached.at < REUSE_MS) return cached.plan;
  const plan = fetchPlan(city);
  plan.catch(() => cache.delete(city));
  cache.set(city, { plan, at: now });
  return plan;
}

/** Current city, its loading state and plan, and `choose` to switch city. */
export function useCityPlan(initial: string): CityState & { choose: (city: string) => void } {
  const [state, setState] = useState<CityState>({ city: initial, status: "loading", plan: null });
  const latest = useRef(0);
  const load = useCallback(async (city: string) => {
    const token = ++latest.current;
    const next: CityState = await planFor(city).then(
      (plan) => ({ city, status: "ready", plan }),
      () => ({ city, status: "error", plan: null }),
    );
    if (token === latest.current) setState(next);
  }, []);
  useEffect(() => {
    void load(initial);
  }, [load, initial]);
  const choose = useCallback(
    (city: string) => {
      setState({ city, status: "loading", plan: null });
      void load(city);
    },
    [load],
  );
  return { ...state, choose };
}
