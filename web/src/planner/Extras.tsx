// The optional parts of the form: the main room and purifier, the daily commute, and a note.
// The number fields are described as data (label and limits) and rendered by one component.
import type { Dispatch, ReactNode } from "react";
import { CONFIG } from "../lib/config";
import type { FormValues } from "../lib/types";
import type { Action } from "./household";

interface Spec<K extends string> {
  key: K;
  label: string;
  min: number;
  max: number;
  step: number;
  placeholder?: string;
}

type Home = FormValues["home"];
type Commute = FormValues["commute"];

const HOME: Spec<"area" | "ceiling">[] = [
  { key: "area", label: "Main room floor area (m²)", min: 4, max: 200, step: 1, placeholder: "e.g. 15" },
  { key: "ceiling", label: "Ceiling height (m)", min: 2, max: 5, step: 0.1 },
];
const CADR: Spec<"cadr"> = {
  key: "cadr",
  label: "Purifier CADR (leave blank if none)",
  min: 0,
  max: 3000,
  step: 1,
  placeholder: "e.g. 250",
};
const DISTANCE: Spec<"distance"> = {
  key: "distance",
  label: "One-way distance (km)",
  min: 0.5,
  max: 100,
  step: 0.5,
  placeholder: "e.g. 8",
};
const CAR: Spec<"occupants" | "trips">[] = [
  { key: "occupants", label: "People in the car", min: 1, max: 7, step: 1 },
  { key: "trips", label: "One-way trips per week", min: 1, max: 28, step: 1 },
];

function NumberField<K extends string>(props: {
  spec: Spec<K>;
  value: string;
  onValue: (key: K, value: string) => void;
  extra?: ReactNode;
}) {
  const { key, label, ...limits } = props.spec;
  return (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <div className="inline">
        <input
          id={key}
          type="number"
          inputMode="decimal"
          {...limits}
          value={props.value}
          onChange={(e) => {
            props.onValue(key, e.target.value);
          }}
        />
        {props.extra}
      </div>
    </div>
  );
}

/** Room size and purifier CADR (m³/h or CFM); everything optional. */
export function HomeFields({ home, dispatch }: { home: Home; dispatch: Dispatch<Action> }) {
  const set = (key: keyof Home, value: string) => {
    dispatch({ type: "home", patch: { [key]: value } });
  };
  const unit = (
    <select
      aria-label="CADR unit"
      value={home.unit}
      onChange={(e) => {
        set("unit", e.target.value);
      }}
    >
      <option value="m3h">m³/h</option>
      <option value="cfm">CFM</option>
    </select>
  );
  return (
    <details className="section">
      <summary>Home and purifier (optional)</summary>
      <div className="grid">
        {HOME.map((spec) => (
          <NumberField key={spec.key} spec={spec} value={home[spec.key]} onValue={set} />
        ))}
        <NumberField spec={CADR} value={home.cadr} onValue={set} extra={unit} />
      </div>
    </details>
  );
}

/** One-way distance, current mode, car occupancy and trips per week; everything optional. */
export function CommuteFields({ commute, dispatch }: { commute: Commute; dispatch: Dispatch<Action> }) {
  const set = (key: keyof Commute, value: string) => {
    dispatch({ type: "commute", patch: { [key]: value } });
  };
  return (
    <details className="section">
      <summary>Daily commute (optional)</summary>
      <div className="grid">
        <NumberField spec={DISTANCE} value={commute.distance} onValue={set} />
        <div className="field">
          <label htmlFor="mode">How you travel now</label>
          <select
            id="mode"
            value={commute.mode}
            onChange={(e) => {
              set("mode", e.target.value);
            }}
          >
            {CONFIG.modes.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {CAR.map((spec) => (
          <NumberField key={spec.key} spec={spec} value={commute[spec.key]} onValue={set} />
        ))}
      </div>
    </details>
  );
}

/** Free-text note the AI briefing reads (as untrusted data); names are best left out. */
export function NoteField({ note, dispatch }: { note: string; dispatch: Dispatch<Action> }) {
  return (
    <div className="field">
      <label htmlFor="note">Anything else? (optional)</label>
      <textarea
        id="note"
        rows={2}
        maxLength={300}
        placeholder="e.g. My son has asthma and wants to play football after school"
        value={note}
        onChange={(e) => {
          dispatch({ type: "note", value: e.target.value });
        }}
      />
    </div>
  );
}
