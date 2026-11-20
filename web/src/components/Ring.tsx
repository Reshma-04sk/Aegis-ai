// The AQI ring: a 270° dial on the EPA 0–500 scale. The track shows every category band in its
// own colour; the value arc takes the current category's colour and sweeps in when motion is on.
// Decorative (aria-hidden): the number and category are always given as text beside it.
import { useEffect, useRef } from "react";
import { CONFIG, categoryKey } from "../lib/config";
import { ringArc, ringBands, ringPercent, RING } from "../lib/geometry";
import { animate, EASE } from "../lib/motion";

const BANDS = ringBands(CONFIG.categories);
const FULL = ringArc(0, 1);
const SWEEP_SECONDS = 1.2;

/** The dial for an AQI value (null: the track only, while data loads). */
export function Ring({ aqi }: { aqi: number | null }) {
  const arc = useRef<SVGPathElement>(null);
  const offset = aqi === null ? 100 : 100 - ringPercent(aqi);
  useEffect(
    () =>
      animate(aqi === null ? null : arc.current, (k) => {
        k.gsap.from(arc.current, {
          attr: { "stroke-dashoffset": 100 },
          duration: SWEEP_SECONDS,
          ease: EASE,
        });
        return undefined;
      }),
    [aqi],
  );
  return (
    <svg className="ring" viewBox={`0 0 ${RING.size} ${RING.size}`} aria-hidden="true" focusable="false">
      <g className="ring-track">
        {BANDS.map((b) => (
          <path key={b.key} d={b.d} className={`band band-${b.key}`} />
        ))}
      </g>
      <path
        ref={arc}
        d={FULL}
        pathLength={100}
        strokeDasharray="100 100"
        strokeDashoffset={offset}
        className={`ring-value fill-${categoryKey(aqi)}`}
      />
    </svg>
  );
}
