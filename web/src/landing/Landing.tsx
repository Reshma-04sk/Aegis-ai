// The landing page: live air for a chosen city, then the story of how a plan is made.
import { Shell } from "../components/Shell";
import type { NavLink } from "../components/Shell";
import { Faq, FinalCta } from "./Faq";
import { Glance } from "./Glance";
import { Hero } from "./Hero";
import { Story } from "./Story";
import { useCityPlan } from "./useCityPlan";

const NAV: NavLink[] = [
  { href: "#method", text: "How it decides" },
  { href: "#faq", text: "Questions" },
  { href: "/plan", text: "Plan my day", cta: true },
];

function liveStatus(state: ReturnType<typeof useCityPlan>): string {
  if (state.status === "loading") return `Fetching the latest forecast for ${state.city}.`;
  if (state.status === "error") return `The forecast for ${state.city} is unavailable right now.`;
  return `${state.plan.location}: US AQI ${Math.round(state.plan.aqi)}, ${state.plan.category}.`;
}

/** Hero, glance tiles, story, questions and the closing call to act. */
export function Landing() {
  const state = useCityPlan("Delhi");
  return (
    <Shell nav={NAV} tone="night">
      <p id="live-status" className="sr-only" aria-live="polite">
        {liveStatus(state)}
      </p>
      <Hero state={state} onChoose={state.choose} />
      <Glance state={state} />
      <Story />
      <Faq />
      <FinalCta city={state.city} />
    </Shell>
  );
}
