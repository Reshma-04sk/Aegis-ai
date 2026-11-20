// Impact cards: the air at home, and the two separate impacts of a commute choice — climate
// emissions for the whole week (macro) and the PM2.5 you breathe on each trip (micro).
import { Card } from "../../components/Card";
import { fmt } from "../../lib/format";
import type { CommuteAdvice, IndoorAdvice, ModeOption } from "../../lib/types";

function purifierText(i: IndoorAdvice): string | null {
  if (!i.purifier_cadr_m3h) return null;
  const sized = i.purifier_adequate ? "It is suitably sized." : "It is undersized for this room.";
  return `Your purifier gives about ${fmt(i.clean_air_changes_per_hour, 1)} clean-air changes per hour and could cut particles by 90% in roughly ${fmt(i.minutes_to_cut_particles_90pct)} minutes (ideal conditions). ${sized}`;
}

/** Room volume, purifier sizing and steps for today. */
export function Indoor({ indoor }: { indoor: IndoorAdvice }) {
  const purifier = purifierText(indoor);
  return (
    <Card title="Indoor air plan" className="indoor">
      <ul className="facts">
        <li>
          Room volume: {fmt(indoor.room_volume_m3)} m³. Recommended purifier CADR: about{" "}
          {fmt(indoor.recommended_cadr_m3h)} m³/h (EPA sizing chart).
        </li>
        {purifier ? <li>{purifier}</li> : null}
      </ul>
      <h3>Steps for today</h3>
      <ul>
        {indoor.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <details>
        <summary>Assumptions</summary>
        <ul>
          {indoor.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function ModeRow({ o }: { o: ModeOption }) {
  return (
    <tr className={o.is_current ? "current" : undefined}>
      <th scope="row">{o.is_current ? `${o.label} (current)` : o.label}</th>
      <td>{o.minutes_per_trip} min</td>
      <td>{fmt(o.emissions_kg_co2e_per_week, 2)}</td>
      <td>{o.is_current ? "–" : fmt(o.emissions_avoided_kg_co2e_per_week, 2)}</td>
      <td>{fmt(o.inhaled_pm25_ug_per_trip, 1)}</td>
    </tr>
  );
}

// Two header rows keep the two impacts apart: climate (whole week) and personal exposure (per trip).
function CommuteHead() {
  return (
    <thead>
      <tr>
        <th rowSpan={2} scope="col">
          Mode
        </th>
        <th rowSpan={2} scope="col">
          Time per trip
        </th>
        <th colSpan={2} scope="colgroup">
          Climate impact
        </th>
        <th scope="col">Your exposure</th>
      </tr>
      <tr>
        <th scope="col">kg CO2e / week</th>
        <th scope="col">kg CO2e avoided / week</th>
        <th scope="col">µg PM2.5 inhaled / trip</th>
      </tr>
    </thead>
  );
}

/** Weekly emissions and per-trip exposure for each mode, in separate columns. */
export function Commute({ commute }: { commute: CommuteAdvice }) {
  return (
    <Card title="Greener commute: the impact of your choice" className="commute">
      <p className="lead">{commute.summary}</p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Commute comparison table">
        <table>
          <caption>
            Two separate impacts: climate emissions (whole week) and the PM2.5 you personally breathe in (per
            trip, at today’s levels).
          </caption>
          <CommuteHead />
          <tbody>
            {commute.options.map((o) => (
              <ModeRow key={o.mode} o={o} />
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Assumptions and sources</summary>
        <ul>
          {[...commute.assumptions, ...commute.sources].map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
