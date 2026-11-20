// The landing page: live data per city, honest loading and error states, the scrubber and links.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Landing } from "../../web/src/landing/Landing";
import { planFor } from "../../web/src/landing/useCityPlan";
import { bodyOf, makePlan, stubFetch } from "./fixtures";

function serveCities(failing: string[] = []) {
  return stubFetch((_url, init) => {
    const { location } = bodyOf(init) as { location: string };
    if (failing.includes(location)) return { status: 502, body: { detail: "upstream down" } };
    const station = location === "Chennai" ? null : makePlan().station;
    return { status: 200, body: makePlan({ location: `${location}, Test State`, station }) };
  });
}

// Plans are reused for five minutes per page view; each test starts later, so none sees another's.
let clock = Date.now();
beforeEach(() => {
  clock += 10 * 60_000;
  vi.setSystemTime(clock);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("landing", () => {
  test("prerenders the hero, sections and a loading state with no data", () => {
    const html = renderToString(<Landing />);
    expect(html).toContain("The air keeps a schedule.");
    expect(html).toContain("Fetching the latest forecast for Delhi");
    expect(html).toContain("within 25 km");
  });

  test("shows Delhi's air as number, category and age, then announces it", async () => {
    serveCities();
    render(<Landing />);
    expect(await screen.findByText("Delhi, Test State")).toBeVisible();
    const now = screen.getByRole("region", { name: "Air quality now" });
    expect(within(now).getByText("170")).toBeVisible();
    expect(within(now).getByText("Unhealthy")).toBeVisible();
    expect(within(now).getByText(/Model estimate \(CAMS\), fetched 5 min ago/)).toBeVisible();
    expect(screen.getByText("Delhi, Test State: US AQI 170, Unhealthy.")).toHaveAttribute(
      "id",
      "live-status",
    );
    expect(screen.getByText(/Cleanest two hours: 10:00 to 12:00, average AQI 90/)).toBeVisible();
    expect(
      screen.getByText(/Station measurement at Fixture Road \(CPCB\), 2\.4 km away, 1 h 5 min ago/),
    ).toBeVisible();
    // The three model tiles share one statement of kind and age, under the section heading.
    const today = screen.getByRole("region", { name: "Today in Delhi" });
    expect(within(today).getByText(/Model estimate \(CAMS\), fetched 5 min ago/)).toBeVisible();
    expect(screen.getByText("14:00")).toBeVisible();
    expect(screen.getByRole("link", { name: "Plan a day in Delhi" })).toHaveAttribute(
      "href",
      "/plan?city=Delhi",
    );
  });

  test("the scrubber reads any hour in words, missing values included", async () => {
    serveCities();
    render(<Landing />);
    const slider = await screen.findByRole("slider", { name: "Read any hour" });
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "00:00: US AQI 170 (Unhealthy), PM2.5 90 µg/m³, forecast",
    );
    fireEvent.change(slider, { target: { value: "5" } });
    expect(screen.getByText("05:00: US AQI n/a (no category), PM2.5 n/a µg/m³, forecast")).toBeVisible();
  });

  test("moving a pointer over the strip picks the hour under it", async () => {
    serveCities();
    const { container } = render(<Landing />);
    await screen.findByText("Delhi, Test State");
    const chart = container.querySelector<HTMLElement>(".strip-chart");
    if (!chart) throw new Error("no strip chart");
    chart.getBoundingClientRect = () => ({ left: 0, width: 240 }) as DOMRect;
    fireEvent.pointerMove(chart, { clientX: 125 }); // the 13th of 24 ten-pixel slots
    expect(screen.getByRole("slider", { name: "Read any hour" })).toHaveValue("12");
    expect(container.querySelector(".bar.is-picked")).not.toBeNull();
    fireEvent.pointerMove(chart, { clientX: 999 }); // outside: unchanged
    expect(screen.getByRole("slider", { name: "Read any hour" })).toHaveValue("12");
  });

  test("switching city shows that city; a failed city says so and never shows old numbers", async () => {
    serveCities(["Kolkata"]);
    render(<Landing />);
    await screen.findByText("Delhi, Test State");
    fireEvent.click(screen.getByRole("button", { name: "Chennai" }));
    expect(screen.getByRole("button", { name: "Chennai" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("Chennai, Test State")).toBeVisible();
    expect(screen.getByText("No official monitor within 25 km has reported recently.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Kolkata" }));
    const now = screen.getByRole("region", { name: "Air quality now" });
    expect(await within(now).findByText(/The forecast for Kolkata is unavailable right now/)).toBeVisible();
    expect(screen.queryByText("170")).toBeNull();
  });

  test("a slower earlier request never overwrites a newer city", async () => {
    let releaseMumbai: () => void = () => undefined;
    stubFetch(async (_url, init) => {
      const { location } = bodyOf(init) as { location: string };
      if (location === "Mumbai") await new Promise<void>((r) => (releaseMumbai = r));
      return { status: 200, body: makePlan({ location: `${location}, Test State` }) };
    });
    render(<Landing />);
    await screen.findByText("Delhi, Test State");
    fireEvent.click(screen.getByRole("button", { name: "Mumbai" }));
    fireEvent.click(screen.getByRole("button", { name: "Bengaluru" }));
    expect(await screen.findByText("Bengaluru, Test State")).toBeVisible();
    await act(async () => {
      releaseMumbai();
      await Promise.resolve();
    });
    expect(screen.queryByText("Mumbai, Test State")).toBeNull();
  });

  test("a stale monitor reading is labelled; an unavailable source is not called 'none nearby'", async () => {
    const stale = makePlan().station;
    if (!stale) throw new Error("fixture has a station");
    const readings = stale.readings.map((r) => ({ ...r, stale: true, data_age_minutes: 540 }));
    stubFetch((_url, init) => {
      const { location } = bodyOf(init) as { location: string };
      return location === "Delhi"
        ? { status: 200, body: makePlan({ station: { ...stale, readings } }) }
        : { status: 200, body: makePlan({ station: null, station_status: "unavailable" }) };
    });
    render(<Landing />);
    expect(await screen.findByText(/9 h 0 min ago/)).toBeVisible();
    expect(screen.getByText(/Stale: older than 3 hours/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Mumbai" }));
    expect(await screen.findByText(/measurements are unavailable right now/)).toBeVisible();
  });

  test("after a failure, pressing the same city tries again", async () => {
    let fail = true;
    stubFetch(() => (fail ? { status: 502, body: {} } : { status: 200, body: makePlan() }));
    render(<Landing />);
    const now = screen.getByRole("region", { name: "Air quality now" });
    expect(await within(now).findByText(/Press Delhi to try again/)).toBeVisible();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Delhi" }));
    expect(await within(now).findByText("170")).toBeVisible();
  });

  test("a city's plan is reused for five minutes, then refetched; a failure is retried", async () => {
    const fetch = serveCities(["Pune"]);
    const t0 = 1_000_000;
    await planFor("Agra", t0);
    await planFor("Agra", t0 + 4 * 60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await planFor("Agra", t0 + 6 * 60_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    fetch.mockClear();
    await expect(planFor("Pune")).rejects.toThrow();
    await expect(planFor("Pune")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("pressing the selected city does not refetch", async () => {
    const fetch = serveCities();
    render(<Landing />);
    await screen.findByText("Delhi, Test State");
    const calls = fetch.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Delhi" }));
    expect(fetch).toHaveBeenCalledTimes(calls);
    vi.restoreAllMocks();
  });
});
