// The live instrument: where, the AQI ring with the number at its centre, then the category
// and how old the estimate is.
import { CategoryBadge } from "../components/Badge";
import { Figure } from "../components/Figure";
import { Ring } from "../components/Ring";
import { ForecastAge } from "../components/ForecastAge";
import type { CityState } from "./useCityPlan";

function Dial({ state }: { state: CityState }) {
  const plan = state.plan;
  return (
    <div className="dial">
      <Ring aqi={plan?.aqi ?? null} />
      <div className="dial-centre">
        {plan ? (
          <Figure value={Math.round(plan.aqi)} unit="US AQI" className="figure-aqi" />
        ) : (
          <p className="figure figure-aqi is-waiting" aria-hidden="true">
            <span className="figure-value">–</span>
          </p>
        )}
      </div>
    </div>
  );
}

function DialFoot({ state }: { state: CityState }) {
  if (!state.plan) {
    return (
      <div className="dial-foot">
        <p className="meta">Fetching the latest forecast for {state.city}…</p>
      </div>
    );
  }
  return (
    <div className="dial-foot">
      <CategoryBadge aqi={state.plan.aqi} />
      <ForecastAge provenance={state.plan.provenance} />
    </div>
  );
}

/** "Air quality now" for the chosen city, with a clear message when its forecast is unavailable. */
export function Instrument({ state }: { state: CityState }) {
  return (
    <section className="instrument" aria-labelledby="now-title" aria-busy={state.status === "loading"}>
      <h2 id="now-title">Air quality now</h2>
      {state.status === "error" ? (
        <p className="error">
          The forecast for {state.city} is unavailable right now. Press {state.city} to try again, or pick
          another city.
        </p>
      ) : (
        <>
          <p className="place">{state.plan?.location ?? state.city}</p>
          <Dial state={state} />
          <DialFoot state={state} />
        </>
      )}
    </section>
  );
}
