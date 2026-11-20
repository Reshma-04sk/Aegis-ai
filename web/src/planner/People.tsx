// "Your household": one row per person, with the groups that make their call stricter.
import { useId } from "react";
import type { Dispatch } from "react";
import { CONFIG } from "../lib/config";
import { MAX_MEMBERS } from "./household";
import type { Action, MemberRow } from "./household";
import { useRowFocus } from "./useRowFocus";

interface RowProps {
  row: MemberRow;
  only: boolean;
  dispatch: Dispatch<Action>;
  onRemove: () => void;
}

function toggle(groups: string[], value: string, on: boolean): string[] {
  return on ? [...groups, value] : groups.filter((g) => g !== value);
}

function Member({ row, only, dispatch, onRemove }: RowProps) {
  const id = useId();
  return (
    <li className="row-card">
      <div className="field">
        <label htmlFor={`${id}-name`}>Name or role</label>
        <input
          id={`${id}-name`}
          type="text"
          maxLength={40}
          placeholder="e.g. Grandma"
          value={row.name}
          onChange={(e) => {
            dispatch({ type: "member", key: row.key, patch: { name: e.target.value } });
          }}
        />
      </div>
      <fieldset className="checks">
        <legend>Sensitive to air pollution?</legend>
        {CONFIG.groups.map((g) => (
          <label key={g.value} className="check">
            <input
              type="checkbox"
              value={g.value}
              checked={row.groups.includes(g.value)}
              onChange={(e) => {
                dispatch({
                  type: "member",
                  key: row.key,
                  patch: { groups: toggle(row.groups, g.value, e.target.checked) },
                });
              }}
            />
            {g.label}
          </label>
        ))}
      </fieldset>
      {only ? null : (
        <button
          type="button"
          className="link remove"
          aria-label={`Remove ${row.name.trim() || "this person"}`}
          onClick={onRemove}
        >
          Remove
        </button>
      )}
    </li>
  );
}

/** The household list with add and remove; at least one person, at most eight. */
export function People({ rows, dispatch }: { rows: MemberRow[]; dispatch: Dispatch<Action> }) {
  const { listRef, addRef, added, removed } = useRowFocus();
  return (
    <fieldset className="group">
      <legend>Your household</legend>
      <ul id="members" ref={listRef} className="rows" aria-label="Household members">
        {rows.map((row, i) => (
          <Member
            key={row.key}
            row={row}
            only={rows.length === 1}
            dispatch={dispatch}
            onRemove={() => {
              removed(i, () => {
                dispatch({ type: "remove", list: "members", key: row.key });
              });
            }}
          />
        ))}
      </ul>
      <button
        ref={addRef}
        type="button"
        className="button-secondary button-small"
        disabled={rows.length >= MAX_MEMBERS}
        onClick={() => {
          added(() => {
            dispatch({ type: "addMember" });
          });
        }}
      >
        + Add a person
      </button>
    </fieldset>
  );
}
