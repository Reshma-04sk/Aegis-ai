// Vitest setup: DOM matchers, a fresh DOM and storage per test, and a reduced-motion default so
// components render their final state without loading GSAP.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// jsdom does no layout, so it has no scrolling; the planner scrolls a new plan into view.
Element.prototype.scrollIntoView = () => undefined;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
