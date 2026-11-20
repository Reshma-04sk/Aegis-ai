// The location field: typed city or rounded device coordinates, and its validation.
import { byId } from "./dom.js";
import { HERE } from "./household.js";
import { showMessage } from "./results.js";

// Three decimals (about 100 m) is enough for an air forecast and keeps the request coarse.
const COORD_DECIMALS = 3;
const LOCATION_TIMEOUT_MS = 10000;

export const locationInput = /** @type {HTMLInputElement} */ (byId("location"));
/** @type {{ latitude: number, longitude: number } | null} */
let coords = null;

/** Rounded device coordinates, or null when the user typed a place. */
export const currentCoords = () => coords;

/** Validate the one required field; mark it invalid and focus it when empty. */
export function locationIsValid() {
  const error = byId("location-error");
  const ok = Boolean(coords) || locationInput.value.trim().length >= 2;
  error.hidden = ok;
  error.textContent = ok ? "" : "Please enter a city or use your location.";
  if (ok) {
    locationInput.removeAttribute("aria-invalid");
  } else {
    locationInput.setAttribute("aria-invalid", "true");
    locationInput.focus();
  }
  return ok;
}

/** @param {GeolocationPosition} pos */
function setPosition(pos) {
  coords = {
    latitude: +pos.coords.latitude.toFixed(COORD_DECIMALS),
    longitude: +pos.coords.longitude.toFixed(COORD_DECIMALS),
  };
  locationInput.value = HERE;
}

/** Ask the browser for the position; explain and fall back to typing on any failure. */
export function useMyLocation() {
  if (!navigator.geolocation) {
    showMessage("Your browser does not support location. Please type a city instead.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    setPosition,
    () => showMessage("Could not get your location. Please type a city instead."),
    { timeout: LOCATION_TIMEOUT_MS },
  );
}

/** Typing a place drops any device coordinates. */
export function bindLocation() {
  locationInput.addEventListener("input", () => {
    if (locationInput.value !== HERE) coords = null;
  });
}
