// The results column: what to do before a plan, the loading state, messages, or the plan's cards.
// A new plan takes focus (so screen readers land on it) and scrolls into view.
import { useEffect, useRef } from "react";
import { animate, DURATION, EASE, prefersReducedMotion, STAGGER } from "../lib/motion";
import type { PlanResponse } from "../lib/types";
import { Briefing } from "./cards/Briefing";
import { Commute, Indoor } from "./cards/Impact";
import { Overview } from "./cards/Overview";
import { MembersCard } from "./cards/People";
import { Schedule } from "./cards/Schedule";
import { Station } from "./cards/Station";
import type { Outcome } from "./usePlanner";

const RISE_PX = 24;

function Empty() {
  return (
    <div className="empty-state">
      <h2>Your plan appears here</h2>
      <p>
        Add a city and press Plan my day. Each person gets a call, each outing gets its cleanest hours, and
        you get steps for the air at home and, with a commute, a greener way to travel.
      </p>
    </div>
  );
}

/** Every card the plan has, in reading order; optional cards are left out, never empty. */
function PlanCards({ plan }: { plan: PlanResponse }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      animate(ref.current, (k) => {
        k.gsap.from(".card", { y: RISE_PX, opacity: 0, duration: DURATION, ease: EASE, stagger: STAGGER });
        return undefined;
      }),
    [plan],
  );
  return (
    <div ref={ref} className="plan-cards">
      <Overview plan={plan} />
      <Station plan={plan} />
      <Briefing plan={plan} />
      <MembersCard plan={plan} />
      <Schedule plan={plan} />
      {plan.indoor ? <Indoor indoor={plan.indoor} /> : null}
      {plan.commute ? <Commute commute={plan.commute} /> : null}
      <p className="help disclaimer">{plan.disclaimer}</p>
    </div>
  );
}

function Message({ text, role }: { text: string; role: "alert" | "status" }) {
  return (
    <p role={role} className={role === "alert" ? "error" : "help"}>
      {text}
    </p>
  );
}

function Body({ outcome }: { outcome: Outcome }) {
  switch (outcome.kind) {
    case "empty":
      return <Empty />;
    case "busy":
      return <p className="help building">Building your plan…</p>;
    case "message":
      return <Message text={outcome.text} role={outcome.role} />;
    case "plan":
      // Keyed by the plan, so each new plan starts with fresh card state (e.g. its own briefing).
      return (
        <PlanCards
          key={outcome.plan.briefing_id ?? outcome.plan.provenance.retrieved_at}
          plan={outcome.plan}
        />
      );
  }
}

/** The live results region. */
export function Results({ outcome }: { outcome: Outcome }) {
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    if (outcome.kind !== "plan" || !region.current) return;
    region.current.focus({ preventScroll: true });
    region.current.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [outcome]);
  return (
    <section
      id="results"
      ref={region}
      aria-live="polite"
      aria-busy={outcome.kind === "busy"}
      tabIndex={-1}
      aria-label="Your plan"
    >
      <Body outcome={outcome} />
    </section>
  );
}
