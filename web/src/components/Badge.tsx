// Badges for an AQI category and a verdict. Never colour alone: each carries an icon (hidden
// from screen readers) and a text label, and the colour comes from its class.
import { categoryOf } from "../lib/config";
import { VERDICTS } from "../lib/format";
import type { Verdict } from "../lib/types";

function Badge({ className, icon, label }: { className: string; icon: string; label: string }) {
  return (
    <span className={`badge ${className}`}>
      <span aria-hidden="true">{icon} </span>
      {label}
    </span>
  );
}

/** The EPA category of an AQI value, or "AQI unknown". */
export function CategoryBadge({ aqi }: { aqi: number | null }) {
  const c = categoryOf(aqi);
  if (!c) return <span className="badge">AQI unknown</span>;
  return <Badge className={`cat-${c.key}`} icon={c.icon} label={c.name} />;
}

/** A household or member verdict: Good to go, Take some care, Limit time outdoors, Stay indoors. */
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICTS[verdict];
  return <Badge className={`verdict-${verdict}`} icon={v.icon} label={v.label} />;
}
