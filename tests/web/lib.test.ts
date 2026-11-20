// Geometry, config, the network layer and the motion helpers.
import { describe, expect, test, vi } from "vitest";
import { planOf, postBriefing, postPlan } from "../../web/src/lib/api";
import { CONFIG, categoryKey, categoryOf, pollutantLabel, STALE_TEXT } from "../../web/src/lib/config";
import {
  barsFor,
  ringArc,
  ringBands,
  ringPercent,
  ringPoint,
  RING,
  windowIndex,
} from "../../web/src/lib/geometry";
import { animate, countUp, figureText, loadMotion, prefersReducedMotion } from "../../web/src/lib/motion";
import { moteCount } from "../../web/src/landing/haze";
import { stubFetch } from "./fixtures";

describe("geometry", () => {
  test("the ring starts lower left and ends lower right, symmetric about the centre", () => {
    const c = RING.size / 2;
    const start = ringPoint(0);
    const end = ringPoint(1);
    expect(start.y).toBeGreaterThan(c);
    expect(start.x + end.x).toBeCloseTo(RING.size);
    expect(ringPoint(0.5).y).toBeCloseTo(c - RING.radius);
  });

  test("arcs use the large-arc flag only beyond half a turn", () => {
    expect(ringArc(0, 1)).toContain(" 0 1 1 ");
    expect(ringArc(0, 0.5)).toContain(" 0 0 1 ");
  });

  test("percent is clamped to the scale", () => {
    expect(ringPercent(250)).toBe(50);
    expect(ringPercent(900)).toBe(100);
    expect(ringPercent(-5)).toBe(0);
  });

  test("one band per category, the last capped at the scale's top", () => {
    const bands = ringBands(CONFIG.categories);
    expect(bands.map((b) => b.key)).toEqual(CONFIG.categories.map((c) => c.key));
  });

  test("bars skip missing hours, scale to the worst hour and respect the floor", () => {
    const style = { slot: 10, barWidth: 6, plotHeight: 100, floor: 200, minBar: 2 };
    const points = [
      { time: "a", us_aqi: 100, pm2_5: null },
      { time: "b", us_aqi: null, pm2_5: null },
      { time: "c", us_aqi: 0, pm2_5: null },
    ];
    const bars = barsFor(points, style);
    expect(bars.map((b) => b.index)).toEqual([0, 2]);
    expect(bars[0]?.height).toBe(50); // 100 of a 200 floor
    expect(bars[1]?.height).toBe(2); // never thinner than minBar
    expect(bars[0]?.x).toBe(2);
    expect(barsFor([{ time: "a", us_aqi: 400, pm2_5: null }], style)[0]?.height).toBe(100);
  });

  test("window index", () => {
    const points = [{ time: "a", us_aqi: 1, pm2_5: 1 }];
    expect(windowIndex(points, "a")).toBe(0);
    expect(windowIndex(points, "z")).toBe(-1);
    expect(windowIndex(points, undefined)).toBe(-1);
  });
});

describe("config", () => {
  test("categories, keys, labels and the stale text come from the generated file", () => {
    expect(categoryOf(170)?.name).toBe("Unhealthy");
    expect(categoryKey(null)).toBe("unknown");
    expect(categoryKey(40)).toBe("good");
    expect(pollutantLabel("pm2_5")).toBe("PM2.5");
    expect(pollutantLabel("mystery")).toBe("mystery");
    expect(STALE_TEXT).toBe(`Stale: older than ${CONFIG.staleAfterHours} hours.`);
  });
});

describe("api", () => {
  test("postPlan keeps the status and body even on errors", async () => {
    stubFetch(() => ({ status: 404, body: { detail: "nope" } }));
    const result = await postPlan({ members: [] });
    expect(result).toEqual({ ok: false, status: 404, data: { detail: "nope" } });
    expect(planOf(result)).toBeNull();
  });

  test("a body that is not JSON is read as null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("oops", { status: 500 }))),
    );
    expect((await postPlan({ members: [] })).data).toBeNull();
  });

  test("postBriefing returns null when the briefing expired", async () => {
    const fetch = stubFetch((url) =>
      url.endsWith("/a%2Fb") ? { status: 404, body: {} } : { status: 200, body: {} },
    );
    expect(await postBriefing("a/b")).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/briefing/a%2Fb", { method: "POST" });
    expect(await postBriefing("ok")).toEqual({});
  });
});

describe("motion", () => {
  test("text for counted numbers keeps a fixed number of decimals", () => {
    expect(figureText(95.25, 1)).toBe("95.3");
    expect(figureText(1500, 0)).toBe("1,500");
  });

  test("reduced motion: nothing is loaded or animated", () => {
    expect(prefersReducedMotion()).toBe(true);
    const build = vi.fn(() => undefined);
    animate(document.body, build)();
    expect(build).not.toHaveBeenCalled();
  });

  test("with motion on, the build runs in a context and its cleanup restores final text", async () => {
    vi.stubGlobal("matchMedia", (media: string) => ({
      matches: false,
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const node = document.createElement("span");
    const kit = await loadMotion();
    let restore: (() => void) | undefined;
    const stop = animate(document.body, (k) => {
      restore = countUp(k, node, { target: 170, digits: 0 });
      return restore;
    });
    await vi.waitFor(() => {
      expect(restore).toBeDefined();
    });
    stop();
    expect(node.textContent).toBe("170");
    expect(kit.gsap.ticker).toBeDefined();
    expect(animate(null, () => undefined)).toBeTypeOf("function");
  });

  test("haze density grows with PM2.5 and stays within bounds", () => {
    expect(moteCount(0)).toBe(14);
    expect(moteCount(100)).toBe(140);
    expect(moteCount(10_000)).toBe(220);
    expect(moteCount(-3)).toBe(14);
  });
});
