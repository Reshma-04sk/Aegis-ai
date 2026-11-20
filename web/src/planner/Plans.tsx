// "Today's outdoor plans": each one is moved to its cleanest forecast hours within its limits.
import { useId } from "react";
import type { Dispatch } from "react";
import { CONFIG } from "../lib/config";
import { MAX_ACTIVITIES } from "./household";
import type { Action, ActivityRow } from "./household";
import { useRowFocus } from "./useRowFocus";

const HOURS = 24;
// API contract: earliest_hour 0–23, latest_hour 1–24.
const EARLIEST = Array.from({ length: HOURS }, (_, h) => h);
const LATEST = Array.from({ length: HOURS }, (_, h) => h + 1);
const clock = (h: number): string => `${String(h).padStart(2, "0")}:00`;

type Patch = (patch: Partial<ActivityRow>) => void;
interface Option {
  value: string;
  label: string;
}

function Select(props: {
  id: string;
  label: string;
  value: string;
  onPick: (v: string) => void;
  options: Option[];
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => {
          props.onPick(e.target.value);
        }}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const hourOptions = (hours: number[]) => hours.map((h) => ({ value: String(h), label: clock(h) }));
const durationOptions = CONFIG.durations.map((d) => ({ value: d, label: d }));

// The four choices of a plan row, in form order.
const SELECTS: { key: "activity" | "duration" | "earliest" | "latest"; label: string; options: Option[] }[] =
  [
    { key: "activity", label: "Activity", options: CONFIG.activities },
    { key: "duration", label: "Hours", options: durationOptions },
    { key: "earliest", label: "Not before", options: hourOptions(EARLIEST) },
    { key: "latest", label: "Done by", options: hourOptions(LATEST) },
  ];

function Plan({ row, patch, onRemove }: { row: ActivityRow; patch: Patch; onRemove: () => void }) {
  const id = useId();
  return (
    <li className="row-card plan-row">
      <div className="field field-wide">
        <label htmlFor={`${id}-label`}>Plan</label>
        <input
          id={`${id}-label`}
          type="text"
          maxLength={40}
          placeholder="e.g. Evening walk"
          value={row.label}
          onChange={(e) => {
            patch({ label: e.target.value });
          }}
        />
      </div>
      {SELECTS.map((s) => (
        <Select
          key={s.key}
          id={`${id}-${s.key}`}
          label={s.label}
          value={row[s.key]}
          options={s.options}
          onPick={(v) => {
            patch({ [s.key]: v });
          }}
        />
      ))}
      <button
        type="button"
        className="link remove"
        aria-label={`Remove ${row.label.trim() || "this plan"}`}
        onClick={onRemove}
      >
        Remove
      </button>
    </li>
  );
}

/** Planned outings with add and remove; at most six. */
export function Plans({ rows, dispatch }: { rows: ActivityRow[]; dispatch: Dispatch<Action> }) {
  const { listRef, addRef, added, removed } = useRowFocus();
  return (
    <fieldset className="group">
      <legend>Today’s outdoor plans</legend>
      <p className="help">Each one is moved to its cleanest forecast hours.</p>
      <ul id="activities" ref={listRef} className="rows" aria-label="Planned activities">
        {rows.map((row, i) => (
          <Plan
            key={row.key}
            row={row}
            patch={(p) => {
              dispatch({ type: "activity", key: row.key, patch: p });
            }}
            onRemove={() => {
              removed(i, () => {
                dispatch({ type: "remove", list: "activities", key: row.key });
              });
            }}
          />
        ))}
      </ul>
      <button
        ref={addRef}
        type="button"
        className="button-secondary button-small"
        disabled={rows.length >= MAX_ACTIVITIES}
        onClick={() => {
          added(() => {
            dispatch({ type: "addActivity" });
          });
        }}
      >
        + Add a plan
      </button>
    </fieldset>
  );
}
