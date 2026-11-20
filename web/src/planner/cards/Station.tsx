// Station card: measured readings from the nearest monitor, beside (never mixed into) the model.
import { Card } from "../../components/Card";
import { CONFIG, STALE_TEXT } from "../../lib/config";
import { ageText, fmt } from "../../lib/format";
import type { PlanResponse, StationObservation, StationReading } from "../../lib/types";

// Readings under 1 (ppm gases such as CO) need more decimals to be meaningful.
const SMALL_VALUE_DIGITS = 3;
const STATUS_TEXT: Record<string, string> = {
  none_nearby: `No monitoring station within ${CONFIG.stationRadiusKm} km has reported in the last ${CONFIG.stationRecentHours} hours, so only the model estimate above is available.`,
  unavailable: "Station measurements are unavailable right now; the model estimate above is unaffected.",
};

function Reading({ r }: { r: StationReading }) {
  const value =
    r.value === null ? "no valid reading" : `${fmt(r.value, r.value < 1 ? SMALL_VALUE_DIGITS : 1)} ${r.unit}`;
  return (
    <div>
      <dt>{r.label}</dt>
      <dd>{value}</dd>
      <dd className="help">{r.data_age_minutes === null ? "time unknown" : ageText(r.data_age_minutes)}</dd>
      {r.stale ? <dd className="stale">{STALE_TEXT}</dd> : null}
    </div>
  );
}

function Measured({ s }: { s: StationObservation }) {
  const kind = s.is_reference_monitor ? "reference monitor" : "sensor";
  return (
    <>
      <p className="meta">
        Measured at {s.station_name} ({s.provider} {kind}), {fmt(s.distance_km, 1)} km away. Station
        measurement, shown beside the model estimate and never mixed into it; units as reported by the
        provider.
      </p>
      <dl className="pollutants">
        {s.readings.map((r) => (
          <Reading key={r.pollutant} r={r} />
        ))}
      </dl>
      <p className="help">{s.attribution}</p>
    </>
  );
}

/** Nearest-station card; left out when no station key is configured. */
export function Station({ plan }: { plan: PlanResponse }) {
  if (plan.station_status === "not_configured") return null;
  return (
    <Card title="Nearest monitoring station" className="station">
      {plan.station ? (
        <Measured s={plan.station} />
      ) : (
        <p className="help">{STATUS_TEXT[plan.station_status]}</p>
      )}
    </Card>
  );
}
