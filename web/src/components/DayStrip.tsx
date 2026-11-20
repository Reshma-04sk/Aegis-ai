// The next 24 hours as a bar strip (landing hero and planner results): the cleanest two hours
// bracketed and named, and a scrubber (a native range input, so it works from the keyboard)
// that reads out any hour in words.
import { useId, useState } from "react";
import { categoryOf } from "../lib/config";
import { fmt, hourLabel } from "../lib/format";
import { windowIndex } from "../lib/geometry";
import type { HourlyPoint, PlanResponse } from "../lib/types";
import { StripChart } from "./StripChart";

const HOURS_SHOWN = 24;

/** One hour in words: time, AQI with its category, and PM2.5, all labelled as forecast. */
export function hourText(p: HourlyPoint): string {
  const category = categoryOf(p.us_aqi)?.name ?? "no category";
  return `${hourLabel(p.time)}: US AQI ${fmt(p.us_aqi)} (${category}), PM2.5 ${fmt(p.pm2_5, 1)} µg/m³, forecast`;
}

function windowText(plan: PlanResponse | null): string {
  if (!plan) return "Reading the forecast…";
  const w = plan.best_window;
  if (!w) return "No complete two-hour window in the forecast.";
  return `Cleanest two hours: ${hourLabel(w.start)} to ${hourLabel(w.end)}, average AQI ${fmt(w.mean_aqi)}.`;
}

function Scrubber(props: { hours: HourlyPoint[]; picked: number; onPick: (i: number) => void }) {
  const id = useId();
  const point = props.hours[props.picked];
  if (!point) return <p className="scrub-readout meta">Hour by hour values appear here.</p>;
  return (
    <div className="scrub">
      <label htmlFor={id}>Read any hour</label>
      <input
        id={id}
        type="range"
        min={0}
        max={props.hours.length - 1}
        value={props.picked}
        aria-valuetext={hourText(point)}
        onChange={(e) => {
          props.onPick(Number(e.target.value));
        }}
      />
      <p className="scrub-readout">{hourText(point)}</p>
    </div>
  );
}

/** The hours shown and where the cleanest window starts among them (-1: none). */
function stripOf(plan: PlanResponse | null): { hours: HourlyPoint[]; start: number } {
  if (!plan) return { hours: [], start: -1 };
  const hours = plan.hourly.slice(0, HOURS_SHOWN);
  return { hours, start: windowIndex(hours, plan.best_window?.start) };
}

/** "The next 24 hours" for a plan (null while it loads), under an h2 or (inside a card) an h3. */
export function DayStrip({
  plan,
  heading: Heading = "h2",
}: {
  plan: PlanResponse | null;
  heading?: "h2" | "h3";
}) {
  const id = useId();
  const { hours, start } = stripOf(plan);
  const [chosen, setChosen] = useState(0);
  const picked = Math.min(chosen, Math.max(hours.length - 1, 0));
  return (
    <section className="strip" aria-labelledby={id} aria-busy={plan === null}>
      <div className="strip-head">
        <Heading id={id}>The next 24 hours</Heading>
        <p className="strip-window">{windowText(plan)}</p>
      </div>
      <StripChart hours={hours} windowStart={start} picked={picked} onPick={setChosen} />
      <Scrubber hours={hours} picked={picked} onPick={setChosen} />
    </section>
  );
}
