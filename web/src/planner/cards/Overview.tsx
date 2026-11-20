// Overview card: where, the AQI ring and number with its category, the household verdict, the
// estimate's age, the pollutants and the mixing layer.
import { CategoryBadge, VerdictBadge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { Figure } from "../../components/Figure";
import { ForecastAge } from "../../components/ForecastAge";
import { Ring } from "../../components/Ring";
import { pollutantLabel } from "../../lib/config";
import { fmt, hourLabel } from "../../lib/format";
import type { PlanResponse, Weather } from "../../lib/types";

function Pollutants({ plan }: { plan: PlanResponse }) {
  const rows = Object.entries(plan.pollutants).filter((e): e is [string, number] => e[1] !== null);
  if (!rows.length) return null;
  return (
    <dl className="pollutants">
      {rows.map(([key, value]) => (
        <div key={key} className={key === plan.dominant_pollutant ? "dominant" : undefined}>
          <dt>{pollutantLabel(key)}</dt>
          <dd>{fmt(value, 1)} µg/m³</dd>
        </div>
      ))}
    </dl>
  );
}

/** When the mixing layer deepens later today, the sentence saying when (else empty). */
function laterText(weather: Weather & { boundary_layer_m: number }): string {
  const peak = weather.peak_boundary_layer_m ?? 0;
  if (!weather.peak_mixing_time || peak <= weather.boundary_layer_m) return "";
  return ` Smog disperses better when this layer is deeper; it is forecast to be deepest around ${hourLabel(weather.peak_mixing_time)} (${fmt(peak)} m).`;
}

function WeatherNote({ weather }: { weather: Weather | null }) {
  const now = weather?.boundary_layer_m;
  if (!weather || now === null || now === undefined) return null;
  return (
    <p className="weather">
      Wind {fmt(weather.wind_speed_kmh)} km/h, mixing layer {fmt(now)} m.
      {laterText({ ...weather, boundary_layer_m: now })}
    </p>
  );
}

/** The first card: where, how bad, for whom, and how old the data is. */
export function Overview({ plan }: { plan: PlanResponse }) {
  return (
    <Card title={plan.location} className="overview">
      <div className="overview-top">
        <div className="dial dial-small">
          <Ring aqi={plan.aqi} />
          <div className="dial-centre">
            <Figure value={Math.round(plan.aqi)} unit="US AQI" className="figure-aqi" />
          </div>
        </div>
        <div className="overview-calls">
          <CategoryBadge aqi={plan.aqi} />
          <p className="label">Household verdict:</p>
          <VerdictBadge verdict={plan.household_verdict} />
        </div>
      </div>
      <ForecastAge provenance={plan.provenance} when />
      <Pollutants plan={plan} />
      <WeatherNote weather={plan.weather} />
    </Card>
  );
}
