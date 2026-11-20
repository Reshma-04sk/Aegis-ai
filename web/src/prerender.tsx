// Server entry for the build: each page rendered to HTML, so it paints (and reads) before any
// script runs. Built by `vite build --ssr` and called from web/prerender.ts.
import { renderToString } from "react-dom/server";
import { Landing } from "./landing/Landing";
import { Planner } from "./planner/Planner";

/** The HTML for a page's #root. */
export function render(page: "landing" | "planner"): string {
  return renderToString(page === "landing" ? <Landing /> : <Planner />);
}
