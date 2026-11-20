// The planner page: the household form beside its results.
import { Shell } from "../components/Shell";
import type { NavLink } from "../components/Shell";
import { PlanForm } from "./PlanForm";
import { Results } from "./Results";
import { usePlanner } from "./usePlanner";

const NAV: NavLink[] = [
  { href: "/", text: "Home" },
  { href: "/#method", text: "How it decides" },
  { href: "/#faq", text: "Questions" },
];

/** Form on the left (top on phones), results on the right (below on phones). */
export function Planner() {
  const p = usePlanner();
  return (
    <Shell nav={NAV} tone="day">
      <section className="planner" aria-labelledby="planner-title">
        <div className="planner-form">
          <p className="kicker">Your household, today</p>
          <h1 id="planner-title">Build your family’s plan</h1>
          <PlanForm
            household={p.household}
            dispatch={p.dispatch}
            placeError={p.placeError}
            placeRef={p.placeRef}
            busy={p.outcome.kind === "busy"}
            onSubmit={p.submit}
            onLocate={p.onLocate}
            onForget={p.forgetAll}
          />
        </div>
        <Results outcome={p.outcome} />
      </section>
    </Shell>
  );
}
