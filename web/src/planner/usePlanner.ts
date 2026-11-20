// The planner's behaviour: validate the place, ask for the plan, use the device location, and
// forget the saved household. The outcome drives the results column.
import { useReducer, useRef, useState } from "react";
import type { Dispatch, SubmitEvent } from "react";
import { planOf, postPlan } from "../lib/api";
import { buildPayload, errorMessage } from "../lib/format";
import type { PlanResponse } from "../lib/types";
import { formValues, reduce } from "./household";
import type { Action, Household } from "./household";
import { forget, initialHousehold, save } from "./storage";

export type Outcome =
  | { kind: "empty" }
  | { kind: "busy" }
  | { kind: "message"; text: string; role: "alert" | "status" }
  | { kind: "plan"; plan: PlanResponse };

type Show = (outcome: Outcome) => void;
const alert = (text: string): Outcome => ({ kind: "message", text, role: "alert" });

// Three decimals (about 100 m) is enough for an air forecast and keeps the request coarse.
const COORD_DECIMALS = 3;
const LOCATION_TIMEOUT_MS = 10_000;
const MIN_PLACE_CHARS = 2;

/** The one required field: a typed place (two characters or more) or device coordinates. */
export const placeIsValid = (h: Household): boolean =>
  h.coords !== null || h.place.trim().length >= MIN_PLACE_CHARS;

async function requestPlan(h: Household, show: Show): Promise<void> {
  save(h);
  show({ kind: "busy" });
  try {
    const result = await postPlan(buildPayload(formValues(h)));
    const plan = planOf(result);
    show(plan ? { kind: "plan", plan } : alert(errorMessage(result.status, result.data)));
  } catch {
    show(alert("Network problem. Please check your connection and try again."));
  }
}

function locate(dispatch: Dispatch<Action>, show: Show): void {
  if (!("geolocation" in navigator)) {
    show(alert("Your browser does not support location. Please type a city instead."));
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const round = (n: number) => Number(n.toFixed(COORD_DECIMALS));
      dispatch({
        type: "coords",
        coords: { latitude: round(pos.coords.latitude), longitude: round(pos.coords.longitude) },
      });
    },
    () => {
      show(alert("Could not get your location. Please type a city instead."));
    },
    { timeout: LOCATION_TIMEOUT_MS },
  );
}

/** Form state, outcome, place validation, and the submit, locate and forget handlers. */
export function usePlanner() {
  const [household, dispatch] = useReducer(reduce, undefined, initialHousehold);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "empty" });
  const [placeError, setPlaceError] = useState("");
  const placeRef = useRef<HTMLInputElement>(null);
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const ok = placeIsValid(household);
    setPlaceError(ok ? "" : "Please enter a city or use your location.");
    if (ok) void requestPlan(household, setOutcome);
    else placeRef.current?.focus();
  };
  const forgetAll = () => {
    forget();
    dispatch({ type: "reset" });
    setOutcome({ kind: "message", text: "Saved household removed from this device.", role: "status" });
  };
  const onLocate = () => {
    locate(dispatch, setOutcome);
  };
  return { household, dispatch, outcome, placeError, placeRef, submit, forgetAll, onLocate };
}
