// The model, age and staleness of a forecast value: shown wherever a forecast value is shown.
import { STALE_TEXT } from "../lib/config";
import { ageText } from "../lib/format";
import type { Provenance } from "../lib/types";

/** "Model estimate (CAMS), fetched 5 min ago." plus a stale warning when it applies. */
export function ForecastAge({ provenance, when = false }: { provenance: Provenance; when?: boolean }) {
  const at = when ? ` for ${provenance.observed_at.replace("T", " ")} local time` : "";
  return (
    <p className="meta">
      Model estimate ({provenance.model}){at}, fetched {ageText(provenance.data_age_minutes)}.
      {provenance.stale ? <strong className="stale"> {STALE_TEXT}</strong> : null}
    </p>
  );
}
