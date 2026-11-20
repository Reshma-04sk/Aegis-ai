// The planner: validation, the request it sends, every result card, the AI briefing upgrade,
// errors, location, rows and focus.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Planner } from "../../web/src/planner/Planner";
import { bodyOf, makePlan, stubFetch } from "./fixtures";

const plan = (overrides = {}) => ({ status: 200, body: makePlan(overrides) });

async function submitFor(place: string) {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("City or neighbourhood"));
  await user.type(screen.getByLabelText("City or neighbourhood"), place);
  await user.click(screen.getByRole("button", { name: "Plan my day" }));
  return user;
}

describe("planner", () => {
  test("an empty place is refused with a message, and focus goes to the field", async () => {
    const fetch = stubFetch(() => plan());
    render(<Planner />);
    await submitFor(" ");
    const field = screen.getByLabelText("City or neighbourhood");
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Please enter a city or use your location.")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("sends the household and shows every card with provenance and separate impacts", async () => {
    const fetch = stubFetch(() => plan());
    render(<Planner />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Asthma / lung" }));
    fireEvent.change(screen.getByLabelText("Main room floor area (m²)"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("CADR unit"), { target: { value: "cfm" } });
    fireEvent.change(screen.getByLabelText("Purifier CADR (leave blank if none)"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("One-way distance (km)"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("How you travel now"), { target: { value: "bus" } });
    fireEvent.change(screen.getByLabelText("Anything else? (optional)"), {
      target: { value: "short please" },
    });
    await submitFor("Delhi");
    const results = screen.getByRole("region", { name: "Your plan" });
    expect(await within(results).findByRole("heading", { name: "Delhi, Test State" })).toBeVisible();
    expect(results).toHaveFocus();
    expect(bodyOf(fetch.mock.calls[0]?.[1])).toMatchObject({
      location: "Delhi",
      members: [{ name: "You", groups: ["asthma"] }],
      home: { floor_area_m2: 15, purifier_cadr_m3h: 170 },
      commute: { distance_km: 8, current_mode: "bus" },
      note: "short please",
    });
    for (const name of [
      "Nearest monitoring station",
      "Your briefing",
      "Who should do what",
      "Your low-exposure day",
      "Indoor air plan",
    ]) {
      expect(within(results).getByRole("heading", { name })).toBeVisible();
    }
    expect(
      within(results).getByText(/Model estimate \(CAMS\) for 2026-11-20 10:00 local time, fetched 5 min ago/),
    ).toBeVisible();
    expect(within(results).getByText(/Fixture Road \(CPCB reference monitor\), 2\.4 km away/)).toBeVisible();
    expect(within(results).getByText("0.05 ppm")).toBeVisible();
    expect(within(results).getByText("no valid reading")).toBeVisible();
    expect(within(results).getAllByText(/Stale: older than 3 hours/)).not.toHaveLength(0);
    expect(within(results).getByText("Rule-based briefing.")).toBeVisible();
    expect(within(results).getByText(/50% less exposure/)).toBeVisible();
    expect(within(results).getByRole("columnheader", { name: "kg CO2e / week" })).toBeVisible();
    expect(within(results).getByRole("columnheader", { name: "µg PM2.5 inhaled / trip" })).toBeVisible();
    expect(within(results).getByText("Petrol car (current)")).toBeVisible();
    expect(within(results).getByText(/It is suitably sized/)).toBeVisible();
    expect(within(results).getByText(/deepest around 14:00 \(900 m\)/)).toBeVisible();
  });

  test("Gemini's briefing replaces the rule-based one; a failed upgrade keeps the rules", async () => {
    stubFetch((url) =>
      url.startsWith("/api/briefing/")
        ? { status: 200, body: { explanation: "Gemini says stay in.", explanation_source: "gemini" } }
        : plan({ briefing_id: "b1" }),
    );
    render(<Planner />);
    await submitFor("Delhi");
    expect(await screen.findByText("Gemini says stay in.")).toBeVisible();
    expect(screen.getByText(/Written by Google Gemini/)).toBeVisible();
    stubFetch((url) =>
      url.startsWith("/api/briefing/") ? { status: 410, body: {} } : plan({ briefing_id: "b2" }),
    );
    await submitFor("Pune");
    expect(await screen.findByText("Rule-based briefing.")).toBeVisible();
    expect(screen.getByText("Rule-based summary.")).toBeVisible();
  });

  test("API errors, rate limits and network failures are alerts", async () => {
    stubFetch(() => ({ status: 404, body: { detail: "could not find a place called 'Nowhere'" } }));
    render(<Planner />);
    await submitFor("Nowhere");
    expect(await screen.findByRole("alert")).toHaveTextContent("could not find a place called 'Nowhere'");
    stubFetch(() => ({ status: 429, body: null }));
    await submitFor("Delhi");
    expect(await screen.findByRole("alert")).toHaveTextContent(/wait a minute/);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    await submitFor("Delhi");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Network problem/);
  });

  test("optional cards are left out; station status is explained", async () => {
    stubFetch(() =>
      plan({
        indoor: null,
        commute: null,
        station: null,
        station_status: "none_nearby",
        best_window: null,
        schedule: [],
        weather: null,
      }),
    );
    render(<Planner />);
    await submitFor("Delhi");
    expect(
      await screen.findByText(/No monitoring station within 25 km has reported in the last 24 hours/),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Indoor air plan" })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Greener commute/ })).toBeNull();
    stubFetch(() => plan({ station_status: "not_configured", station: null }));
    await submitFor("Pune");
    await screen.findByText("Delhi, Test State");
    expect(screen.queryByRole("heading", { name: "Nearest monitoring station" })).toBeNull();
  });

  test("adding and removing rows moves focus; the last person stays", async () => {
    render(<Planner />);
    const user = userEvent.setup();
    expect(screen.queryByRole("button", { name: "Remove You" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "+ Add a person" }));
    const [, second] = screen.getAllByLabelText("Name or role");
    if (!second) throw new Error("no second person");
    expect(second).toHaveFocus();
    await user.type(second, "Gran");
    await user.click(screen.getByRole("button", { name: "Remove Gran" }));
    expect(screen.getByLabelText("Name or role")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Remove Walk" }));
    expect(screen.getByRole("button", { name: "+ Add a plan" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "+ Add a plan" }));
    expect(screen.getByLabelText("Plan")).toHaveFocus();
    await user.selectOptions(screen.getByLabelText("Done by"), "18");
    expect(screen.getByLabelText("Done by")).toHaveValue("18");
  });

  test("forgetting the household resets the form and says so", async () => {
    stubFetch(() => plan());
    render(<Planner />);
    const user = await submitFor("Delhi");
    await user.click(screen.getByRole("button", { name: "+ Add a person" }));
    await user.click(screen.getByRole("button", { name: "Forget saved household" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved household removed from this device.");
    expect(screen.getAllByLabelText("Name or role")).toHaveLength(1);
    expect(localStorage.length).toBe(0);
  });

  test("location: rounded coordinates when allowed, a message when refused or unsupported", async () => {
    const fetch = stubFetch(() => plan());
    const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
      if (getCurrentPosition.mock.calls.length === 1) {
        ok({ coords: { latitude: 28.61394, longitude: 77.20902 } } as GeolocationPosition);
      } else fail({} as GeolocationPositionError);
    });
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    render(<Planner />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(screen.getByLabelText("City or neighbourhood")).toHaveValue("My current location");
    await user.click(screen.getByRole("button", { name: "Plan my day" }));
    await waitFor(() => {
      expect(bodyOf(fetch.mock.calls[0]?.[1])).toMatchObject({ latitude: 28.614, longitude: 77.209 });
    });
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not get your location/);
    Reflect.deleteProperty(navigator, "geolocation");
    await user.click(screen.getByRole("button", { name: "Use my location" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/does not support location/);
  });
});
