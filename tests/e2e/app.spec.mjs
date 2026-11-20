// End-to-end: real browser, real front end, real API, fixed air data (see fixture_app.py).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoA11yViolations(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const found = violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id} at ${n.target.join(" ")}: ${n.any[0]?.message ?? n.failureSummary}`),
  );
  expect(found).toEqual([]);
}

// Cumulative Layout Shift since navigation (Core Web Vitals "good" is under 0.1).
async function layoutShift(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) total += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 1500);
      }),
  );
}

async function planFor(page, place) {
  await page.getByLabel("City or neighbourhood").fill(place);
  await page.getByRole("button", { name: "Plan my day" }).click();
}

// ---------------------------------------------------------------- planner page (/plan)
test.describe("planner", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/plan");
  });
  test("loads without layout shift: rows render before the first paint", async ({ page }) => {
    expect(await layoutShift(page)).toBeLessThan(0.05);
  });

  test("empty form meets WCAG 2.1 AA and fits the viewport", async ({ page }) => {
    await expectNoA11yViolations(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("household plan shows verdicts, provenance, schedule, indoor and commute", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Asthma / lung" }).check();
    await page.getByText("Home and purifier (optional)").click();
    await page.getByLabel("Main room floor area (m²)").fill("15");
    await page.getByLabel("Purifier CADR (leave blank if none)").fill("250");
    await page.getByText("Daily commute (optional)").click();
    await page.getByLabel("One-way distance (km)").fill("8");
    await planFor(page, "Delhi");

    const results = page.locator("#results");
    await expect(results.getByRole("heading", { name: "Delhi, Test State" })).toBeVisible();
    await expect(results).toBeFocused();
    // AQI is number + category text + icon, never colour alone.
    await expect(results.getByText("170", { exact: true }).first()).toBeVisible();
    await expect(results.getByText("Unhealthy").first()).toBeVisible();
    await expect(results.getByText("✖ Stay indoors").first()).toBeVisible();
    // Data honesty: model estimate label and data age.
    await expect(results.getByText(/Model estimate .* fetched 5 min ago/)).toBeVisible();
    // Measured station data sits beside the forecast, labelled and attributed.
    const station = results.getByRole("region", { name: "Nearest monitoring station" });
    await expect(station.getByText(/Fixture Road \(CPCB reference monitor\), 2\.4 km away/)).toBeVisible();
    await expect(station.getByText("98 µg/m³")).toBeVisible();
    await expect(station.getByText("0.05 ppm")).toBeVisible();
    await expect(station.getByText(/via OpenAQ/)).toBeVisible();
    // Each part of the plan.
    for (const name of ["Your briefing", "Who should do what", "Your low-exposure day", "Indoor air plan"]) {
      await expect(results.getByRole("heading", { name })).toBeVisible();
    }
    await expect(results.getByRole("heading", { name: /Greener commute/ })).toBeVisible();
    // The routine explains the impact of the chosen time as personal exposure.
    await expect(results.getByText(/% less exposure from choosing this time/)).toBeVisible();
    // Macro (kg CO2e) and micro (inhaled PM2.5) stay separate.
    await expect(results.getByText(/kg CO2e per week/).first()).toBeVisible();
    await expect(results.getByText(/breathe in more particles per trip/).first()).toBeVisible();
    // No API key in tests, so the rule-based briefing must remain.
    await expect(results.getByText("Rule-based briefing.")).toBeVisible();
    await expect(results).not.toHaveAttribute("data-animating", "true");
    await expectNoA11yViolations(page);
  });

  test("unknown place is announced as an alert", async ({ page }) => {
    await planFor(page, "Nowhere");
    await expect(page.getByRole("alert")).toHaveText("could not find a place called 'Nowhere'");
    await expectNoA11yViolations(page);
  });

  test("keyboard: skip link is first and moves focus to main content", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("reduced motion disables animations", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const duration = await page.evaluate(
      () => getComputedStyle(document.querySelector("button")).transitionDuration,
    );
    expect(duration).toBe("0s");
  });

  test("the sky follows the plan's real AQI, and new rows ease in", async ({ page }) => {
    const haze = () => page.locator(".haze-1").evaluate((e) => Number(getComputedStyle(e).opacity));
    expect(await haze()).toBeLessThan(0.05); // clear before any plan
    await page.getByRole("button", { name: "+ Add a person" }).click();
    await expect(page.locator("#members > li")).toHaveCount(2);
    await planFor(page, "Delhi"); // fixture AQI 170, Unhealthy
    await expect(page.locator("#results")).not.toHaveAttribute("data-animating", "true");
    await expect.poll(haze, { timeout: 6000 }).toBeGreaterThan(0.5);
  });

  test("the city rises behind the form as you scroll; a mouse lights the glass", async ({
    page,
    isMobile,
  }) => {
    const treesY = () =>
      page.locator(".trees").evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).f);
    expect(await treesY()).toBeGreaterThan(-1);
    await page.mouse.wheel(0, 1200);
    await expect.poll(treesY, { timeout: 4000 }).toBeLessThan(-20);
    const panel = page.locator(".planner > .glass");
    if (isMobile) {
      await expect(panel).not.toHaveClass(/has-glow/); // touch: no pointer light
    } else {
      await page.mouse.move(600, 400);
      await page.mouse.move(640, 420, { steps: 3 });
      await expect(panel).toHaveClass(/is-lit/);
    }
  });

  test("reduced motion: the planner sky stays still", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/plan");
    await planFor(page, "Delhi");
    await expect(page.locator("#results")).toBeFocused();
    await page.waitForTimeout(800);
    expect(await page.locator(".haze-1").evaluate((e) => Number(getComputedStyle(e).opacity))).toBeLessThan(
      0.05,
    );
    await expect(page.locator("html")).not.toHaveClass(/lenis/);
  });

  test("a city chosen on the landing page prefills the planner", async ({ page }) => {
    await page.goto("/plan?city=Kolkata");
    await expect(page.getByLabel("City or neighbourhood")).toHaveValue("Kolkata");
  });
});

// ---------------------------------------------------------------- landing page (/)
test.describe("landing", () => {
  test("loads without layout shift: fonts swap into metric-matched fallbacks", async ({ page }) => {
    await page.goto("/");
    expect(await layoutShift(page)).toBeLessThan(0.05);
  });

  test("hero, every section, and WCAG 2.1 AA with live data shown", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(/Winter smog thins out/);
    for (const name of [
      "Right now, city by city",
      "One plan for everyone at home",
      "Why winter mornings are the worst",
      "For the people you worry about",
      "How it decides",
      "Forecast and measurement, side by side",
      "Questions people ask",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeAttached();
    }
    await page.locator("#now").scrollIntoViewIfNeeded();
    await expect(page.getByText("Delhi, Test State")).toBeVisible();
    await expect(page.locator(".live-aqi")).toContainText("170");
    await expect(page.getByText(/Measured at Fixture Road \(CPCB\)/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Plan a day in Delhi" })).toHaveAttribute(
      "href",
      "/plan?city=Delhi",
    );
    await expectNoA11yViolations(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    expect(errors).toEqual([]);
  });

  test("city chips switch the live forecast and announce the pressed city", async ({ page }) => {
    await page.goto("/");
    await page.locator("#now").scrollIntoViewIfNeeded();
    await expect(page.getByText("Delhi, Test State")).toBeVisible();
    await page.getByRole("button", { name: "Mumbai" }).click();
    await expect(page.getByRole("button", { name: "Mumbai" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Delhi" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("Mumbai, Test State")).toBeVisible();
  });

  test("calls to action open the planner; in-page links move focus", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "See the air right now" }).click();
    await expect(page.locator("#now")).toBeFocused();
    await expect(page).toHaveURL(/#now$/);
    await page.getByRole("link", { name: "Plan my family’s day" }).first().click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByRole("heading", { level: 1, name: "Plan your family’s day" })).toBeVisible();
  });

  test("FAQ answers open from the keyboard", async ({ page }) => {
    await page.goto("/");
    const summary = page.getByText("Is this medical advice?");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("turns public air-quality data and published guidance")).toBeVisible();
  });

  test("custom cursor follows a mouse, grows over links, and never appears on touch", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    const html = page.locator("html");
    if (isMobile) {
      await expect(html).not.toHaveClass(/has-cursor/);
      await expect(page.locator(".cursor-dot")).toHaveCount(0);
      return;
    }
    await expect(html).toHaveClass(/has-cursor/);
    await page.mouse.move(300, 300);
    await expect(html).toHaveClass(/cursor-visible/);
    await page.getByRole("link", { name: "Plan my day" }).hover();
    await expect(html).toHaveClass(/cursor-hover/);
    await expect(page.locator(".cursor-dot")).toHaveAttribute("aria-hidden", "true");
  });

  test("reduced motion: clear sky, native scrolling, no custom cursor", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveClass(/sky-is-clear/);
    await expect(html).not.toHaveClass(/lenis/);
    await expect(html).not.toHaveClass(/has-cursor/);
    await expect(page.locator(".scroll-cue")).toBeHidden();
    await page.getByRole("link", { name: "See the air right now" }).click();
    await expect(page.locator("#now")).toBeFocused();
  });
});
