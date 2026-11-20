// Landing page entry: hydrate the prerendered HTML (web/prerender.ts) in place.
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { Landing } from "./landing/Landing";
import "./styles/base.css";
import "./styles/landing.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from the page");
hydrateRoot(
  root,
  <StrictMode>
    <Landing />
  </StrictMode>,
);
