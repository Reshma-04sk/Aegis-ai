// The hero: a night sky tinted by today's AQI category, a haze drawn from the PM2.5 forecast,
// the headline and city picker, the live instrument, and the scrubbable 24-hour strip.
import { categoryKey } from "../lib/config";
import { DayStrip } from "../components/DayStrip";
import { HazeCanvas } from "./HazeCanvas";
import { Instrument } from "./Instrument";
import { CITIES } from "./useCityPlan";
import type { CityState } from "./useCityPlan";

function CityPicker({ state, onChoose }: { state: CityState; onChoose: (city: string) => void }) {
  return (
    <div className="cities" role="group" aria-label="Show the air for">
      {CITIES.map((name) => (
        <button
          key={name}
          type="button"
          className="city"
          aria-pressed={name === state.city}
          onClick={() => {
            // Re-pressing the shown city only matters after a failure: it retries.
            if (name !== state.city || state.status === "error") onChoose(name);
          }}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function HeroCopy({ state, onChoose }: { state: CityState; onChoose: (city: string) => void }) {
  return (
    <div className="hero-copy">
      <p className="eyebrow">
        <span className="pulse" aria-hidden="true" /> Live forecast and the nearest official monitor
      </p>
      <h1 id="hero-title">
        The air keeps a schedule. <em>Plan your family around it.</em>
      </h1>
      <p className="lede">
        Aegis reads today’s smog hour by hour and turns it into one clear call for your household: who goes
        out, when, and what to change at home.
      </p>
      <CityPicker state={state} onChoose={onChoose} />
      <p className="hero-alt">
        <a href="/plan">Plan for any other place</a>
      </p>
    </div>
  );
}

/** The opening section; its tint and haze follow the selected city's air. */
export function Hero({ state, onChoose }: { state: CityState; onChoose: (city: string) => void }) {
  const plan = state.plan;
  return (
    <section
      className="hero"
      data-category={plan ? categoryKey(plan.aqi) : "unknown"}
      aria-labelledby="hero-title"
    >
      <HazeCanvas pm25={plan?.pollutants.pm2_5 ?? null} />
      <div className="hero-inner">
        <HeroCopy state={state} onChoose={onChoose} />
        <Instrument state={state} />
      </div>
      <DayStrip plan={plan} />
    </section>
  );
}
