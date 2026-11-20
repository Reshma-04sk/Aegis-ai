// The planner form: place, household, plans, home, commute and note, in numbered steps.
import type { Dispatch, SubmitEvent, RefObject } from "react";
import { CommuteFields, HomeFields, NoteField } from "./Extras";
import type { Action, Household } from "./household";
import { People } from "./People";
import { Plans } from "./Plans";

interface Props {
  household: Household;
  dispatch: Dispatch<Action>;
  placeError: string;
  placeRef: RefObject<HTMLInputElement | null>;
  busy: boolean;
  onSubmit: (event: SubmitEvent) => void;
  onLocate: () => void;
  onForget: () => void;
}

function PlaceField({ household, dispatch, placeError, placeRef, onLocate }: Props) {
  return (
    <div className="field">
      <label htmlFor="location">City or neighbourhood</label>
      <div className="inline">
        <input
          ref={placeRef}
          id="location"
          name="location"
          type="text"
          autoComplete="address-level2"
          maxLength={100}
          placeholder="e.g. Delhi"
          aria-describedby="location-error"
          aria-invalid={placeError ? true : undefined}
          required
          value={household.place}
          onChange={(e) => {
            dispatch({ type: "place", value: e.target.value });
          }}
        />
        <button type="button" className="button-secondary" onClick={onLocate}>
          Use my location
        </button>
      </div>
      <p id="location-error" className="error" hidden={!placeError}>
        {placeError}
      </p>
    </div>
  );
}

/** The whole form; only the place is required and everything stays on this device. */
export function PlanForm(props: Props) {
  const { household, dispatch } = props;
  return (
    <form id="plan-form" noValidate aria-describedby="form-help" onSubmit={props.onSubmit}>
      <p id="form-help" className="help">
        Only the place is required. Everything you enter stays on this device.
      </p>
      <PlaceField {...props} />
      <People rows={household.members} dispatch={dispatch} />
      <Plans rows={household.activities} dispatch={dispatch} />
      <HomeFields home={household.home} dispatch={dispatch} />
      <CommuteFields commute={household.commute} dispatch={dispatch} />
      <NoteField note={household.note} dispatch={dispatch} />
      <div className="actions">
        <button type="submit" className="button button-large" disabled={props.busy} aria-busy={props.busy}>
          Plan my day
        </button>
        <button type="button" className="link" disabled={props.busy} onClick={props.onForget}>
          Forget saved household
        </button>
      </div>
    </form>
  );
}
