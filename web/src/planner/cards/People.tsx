// Members card: one verdict with reasons and actions per person.
import { VerdictBadge } from "../../components/Badge";
import { Card } from "../../components/Card";
import type { PlanResponse } from "../../lib/types";

/** Who should do what, one article per household member. */
export function MembersCard({ plan }: { plan: PlanResponse }) {
  return (
    <Card title="Who should do what" className="members">
      <div className="members-grid">
        {plan.members.map((m, i) => (
          <article key={`${m.name}-${i}`} className={`member verdict-edge-${m.verdict}`}>
            <h3>{m.name}</h3>
            <VerdictBadge verdict={m.verdict} />
            <ul className="reasons">
              {m.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <ul>
              {m.actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Card>
  );
}
