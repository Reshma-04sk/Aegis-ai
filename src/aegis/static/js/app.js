// Planner page wiring: the form, location, submit and household controls.
import { postPlan } from "./api.js";
import { buildPayload, errorMessage } from "./format.js";
import { byId } from "./dom.js";
import { addActivity, addMember, readActivities, readMembers } from "./household.js";
import { forget, restore, save } from "./storage.js";
import { bindLocation, currentCoords, locationInput, locationIsValid, useMyLocation } from "./location.js";
import { setBusy, showMessage, showPlan } from "./results.js";

/** @param {string} id */
const value = (id) =>
  /** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} */ (byId(id)).value;

/** Everything the form says, as the API request body. */
function payload() {
  return buildPayload({
    coords: currentCoords(),
    location: locationInput.value,
    members: readMembers(),
    activities: readActivities(),
    home: { area: value("area"), ceiling: value("ceiling"), cadr: value("cadr"), unit: value("cadr-unit") },
    commute: {
      distance: value("distance"),
      mode: value("mode"),
      occupants: value("occupants"),
      trips: value("trips"),
    },
    note: value("note"),
  });
}

/** @param {SubmitEvent} event */
async function submit(event) {
  event.preventDefault();
  if (!locationIsValid()) return;
  const body = payload();
  save(locationInput.value);
  setBusy(true);
  try {
    const { ok, status, data } = await postPlan(body);
    if (ok && data) showPlan(data);
    else showMessage(errorMessage(status, data));
  } catch {
    showMessage("Network problem. Please check your connection and try again.");
  } finally {
    setBusy(false);
  }
}

byId("add-member").addEventListener("click", () => addMember()?.querySelector("input")?.focus());
byId("add-activity").addEventListener("click", () => addActivity()?.querySelector("input")?.focus());
byId("forget-btn").addEventListener("click", () => {
  forget();
  showMessage("Saved household removed from this device.", "status", "help");
});
byId("geo-btn").addEventListener("click", useMyLocation);
bindLocation();
byId("plan-form").addEventListener("submit", (event) => submit(/** @type {SubmitEvent} */ (event)));

restore(locationInput);
