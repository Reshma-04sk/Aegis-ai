// "How Aegis decides": Sense → Decide → Explain on a line that draws itself as you scroll,
// making the point that a model only ever takes part at the last step.
import { useEffect, useRef } from "react";
import { CONFIG } from "../lib/config";
import { animate } from "../lib/motion";

const STEPS = [
  {
    title: "Sense",
    tag: "Data",
    text: `The next 24 hours of the Copernicus CAMS forecast for your spot, and the nearest reference monitor within ${CONFIG.stationRadiusKm} km, such as a CPCB station.`,
  },
  {
    title: "Decide",
    tag: "Rules",
    text: "Published EPA categories and health guidance set every call, identically every time. No model takes part.",
  },
  {
    title: "Explain",
    tag: "Gemini",
    text: "Google Gemini rewrites the finished plan in plain words. It sees no names and cannot alter a call or a number.",
  },
];

function useDrawnLine() {
  const ref = useRef<HTMLElement>(null);
  useEffect(
    () =>
      animate(ref.current, (k) => {
        k.gsap.from(".method-line path", {
          attr: { "stroke-dashoffset": 100 },
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top 75%", end: "bottom 60%", scrub: true },
        });
        k.gsap.from(".method-step", {
          y: 28,
          opacity: 0,
          stagger: 0.15,
          scrollTrigger: { trigger: ref.current, start: "top 75%", once: true },
        });
        return undefined;
      }),
    [],
  );
  return ref;
}

/** Three steps on one drawn line; the line is decorative, the list carries the content. */
export function Method() {
  const ref = useDrawnLine();
  return (
    <section ref={ref} className="band method" id="method" tabIndex={-1} aria-labelledby="method-title">
      <h2 id="method-title">How Aegis decides</h2>
      <svg
        className="method-line"
        viewBox="0 0 100 2"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M0 1 H100" pathLength={100} strokeDasharray="100 100" strokeDashoffset={0} />
      </svg>
      <ol className="method-steps">
        {STEPS.map((s) => (
          <li key={s.title} className="method-step">
            <span className="method-tag">{s.tag}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
