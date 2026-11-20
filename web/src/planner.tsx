// Planner page entry. The prerendered HTML paints first; React then renders over it, because the
// form's first state comes from this device's saved household, which the prerender cannot know.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Planner } from "./planner/Planner";
import "./styles/base.css";
import "./styles/planner.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from the page");
createRoot(root).render(
  <StrictMode>
    <Planner />
  </StrictMode>,
);
