// Schedule card: the cleanest window, each activity in its slot, the 24-hour strip, and the same
// hourly numbers as a table so they never depend on the graphic.
import { VerdictBadge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { DayStrip } from "../../components/DayStrip";
import { categoryOf } from "../../lib/config";
import { fmt, hourLabel } from "../../lib/format";
import type { HourlyPoint, PlanResponse, ScheduledActivity, TimeWindow } from "../../lib/types";

function windowText(w: TimeWindow): string {
  if (w.starts_now) return "Right now is the cleanest time in the next 24 hours.";
  return `Cleanest 2 hours in the next day: ${hourLabel(w.start)} to ${hourLabel(w.end)} (average AQI ${fmt(w.mean_aqi)}).`;
}

function Slot({ s }: { s: ScheduledActivity }) {
  return (
    <li>
      <strong>{s.label}</strong>
      {s.window ? (
        <>
          {" "}
          · {hourLabel(s.window.start)} to {hourLabel(s.window.end)} · AQI {fmt(s.window.mean_aqi)}{" "}
        </>
      ) : null}
      {s.window && s.verdict ? <VerdictBadge verdict={s.verdict} /> : null}
      <p>{s.advice}</p>
      {s.exposure_note ? <p className="help">{s.exposure_note}</p> : null}
    </li>
  );
}

function HourlyTable({ hourly }: { hourly: HourlyPoint[] }) {
  return (
    <details>
      <summary>Hourly values (table)</summary>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Hourly values">
        <table>
          <caption className="sr-only">US AQI and PM2.5 by hour (model forecast)</caption>
          <thead>
            <tr>
              {["Time", "US AQI", "Category", "PM2.5 µg/m³"].map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hourly.map((p) => (
              <tr key={p.time}>
                <td>{hourLabel(p.time)}</td>
                <td>{fmt(p.us_aqi)}</td>
                <td>{categoryOf(p.us_aqi)?.name ?? "n/a"}</td>
                <td>{fmt(p.pm2_5, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** The low-exposure day: best window, scheduled activities, hourly strip and table. */
export function Schedule({ plan }: { plan: PlanResponse }) {
  return (
    <Card title="Your low-exposure day" className="schedule">
      {plan.best_window ? <p className="lead">{windowText(plan.best_window)}</p> : null}
      {plan.schedule.length ? (
        <ol className="slots">
          {plan.schedule.map((s) => (
            <Slot key={s.label} s={s} />
          ))}
        </ol>
      ) : null}
      <DayStrip plan={plan} heading="h3" />
      <HourlyTable hourly={plan.hourly} />
    </Card>
  );
}
