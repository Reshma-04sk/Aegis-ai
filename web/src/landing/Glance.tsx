// "Today at a glance": the call for a healthy adult, the particles, the best mixing hour, the
// nearest monitor and the way into the planner. The first three come from the model estimate,
// whose kind and age are stated under the heading; the monitor tile states its own, and stale.
import { useId } from "react";
import type { ReactNode } from "react";
import { VerdictBadge } from "../components/Badge";
import { Figure } from "../components/Figure";
import { ForecastAge } from "../components/ForecastAge";
import { CONFIG, pollutantLabel, STALE_TEXT } from "../lib/config";
import { ageText, fmt, hourLabel } from "../lib/format";
import type { PlanResponse, StationObservation, StationReading } from "../lib/types";
import type { CityState } from "./useCityPlan";

function Tile(props: {
  title: string;
  name: string;
  plan: PlanResponse | null;
  children: (p: PlanResponse) => ReactNode;
}) {
  const id = useId();
  return (
    <article className={`tile tile-${props.name}`} aria-labelledby={id} aria-busy={props.plan === null}>
      <h3 id={id}>{props.title}</h3>
      {props.plan ? props.children(props.plan) : <div className="tile-wait" />}
    </article>
  );
}

function Verdict({ plan }: { plan: PlanResponse }) {
  const adult = plan.members[0];
  return (
    <>
      <p className="meta">For a healthy adult:</p>
      <VerdictBadge verdict={plan.household_verdict} />
      <p className="lead">{adult?.actions[0] ?? plan.explanation}</p>
      <p className="meta">
        Children, older adults and anyone with asthma or a heart condition get a stricter call in their plan.
      </p>
    </>
  );
}

function Particles({ plan }: { plan: PlanResponse }) {
  const pm = plan.pollutants.pm2_5;
  const main = plan.dominant_pollutant ? pollutantLabel(plan.dominant_pollutant) : null;
  return (
    <>
      {pm === null || pm === undefined ? (
        <p className="meta">No PM2.5 value in this forecast.</p>
      ) : (
        <Figure value={pm} unit="µg/m³ PM2.5" digits={1} />
      )}
      <p className="meta">{main ? `${main} drives today’s AQI. ` : "No single pollutant dominates."}</p>
    </>
  );
}

function Mixing({ plan }: { plan: PlanResponse }) {
  const w = plan.weather;
  if (!w?.peak_mixing_time) return <p className="meta">No mixing-layer forecast for this place.</p>;
  const now = w.boundary_layer_m === null ? "" : ` Now ${fmt(w.boundary_layer_m)} m deep.`;
  return (
    <>
      <p className="figure figure-time">{hourLabel(w.peak_mixing_time)}</p>
      <p className="meta">
        The air layer is deepest then ({fmt(w.peak_boundary_layer_m)} m), so smog spreads out.{now}
      </p>
    </>
  );
}

/** The station's PM2.5 reading, when it has a value. */
function measuredPm(
  plan: PlanResponse,
): { s: StationObservation; pm: StationReading & { value: number } } | null {
  const s = plan.station;
  const pm = s?.readings.find((r) => r.pollutant === "pm25");
  return s && pm && pm.value !== null ? { s, pm: { ...pm, value: pm.value } } : null;
}

const NO_STATION =
  "The nearest monitor's measurements are unavailable right now; the model estimate is unaffected.";
const NONE_NEARBY = `No official monitor within ${CONFIG.stationRadiusKm} km has reported recently.`;

function Station({ plan }: { plan: PlanResponse }) {
  const found = measuredPm(plan);
  if (!found) {
    return <p className="meta">{plan.station_status === "unavailable" ? NO_STATION : NONE_NEARBY}</p>;
  }
  const { s, pm } = found;
  const age = pm.data_age_minutes === null ? "time unknown" : ageText(pm.data_age_minutes);
  return (
    <>
      <Figure value={pm.value} unit={`${pm.unit} PM2.5`} digits={1} />
      <p className="meta">
        Station measurement at {s.station_name} ({s.provider}), {fmt(s.distance_km, 1)} km away, {age}.
        {pm.stale ? <strong className="stale"> {STALE_TEXT}</strong> : null}
      </p>
    </>
  );
}

/** The five tiles for the chosen city; they wait (with a shimmer) while it loads. */
export function Glance({ state }: { state: CityState }) {
  return (
    <section className="glance band" aria-labelledby="glance-title">
      <h2 id="glance-title">Today in {state.city}</h2>
      {state.plan ? <ForecastAge provenance={state.plan.provenance} /> : <p className="meta">&nbsp;</p>}
      <div className="tiles">
        <Tile title="Today’s call" name="verdict" plan={state.plan}>
          {(p) => <Verdict plan={p} />}
        </Tile>
        <Tile title="Fine particles" name="pm" plan={state.plan}>
          {(p) => <Particles plan={p} />}
        </Tile>
        <Tile title="Air mixes best at" name="mixing" plan={state.plan}>
          {(p) => <Mixing plan={p} />}
        </Tile>
        <Tile title="Measured nearby" name="station" plan={state.plan}>
          {(p) => <Station plan={p} />}
        </Tile>
        <article className="tile tile-cta" aria-labelledby="cta-title">
          <h3 id="cta-title">Make it personal</h3>
          <p>Add who lives with you and what you have planned.</p>
          <a className="button" href={`/plan?city=${encodeURIComponent(state.city)}`}>
            Plan a day in {state.city}
          </a>
        </article>
      </div>
    </section>
  );
}
