// The strip's graphic: one bar per hour coloured by EPA category, the cleanest window behind
// them, and a marker on the hour being read. Pointer users scrub by moving over it; keyboard and
// screen-reader users use the range input below, which carries the same values as text.
import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import { categoryKey } from "../lib/config";
import { hourLabel } from "../lib/format";
import { barsFor } from "../lib/geometry";
import type { ChartStyle } from "../lib/geometry";
import { animate, EASE } from "../lib/motion";
import type { HourlyPoint } from "../lib/types";

const STYLE: ChartStyle = { slot: 40, barWidth: 26, plotHeight: 150, floor: 200, minBar: 3 };
const WINDOW_HOURS = 2;
const WINDOW_INSET = 2; // the bracket sits just inside its two hours
const LABEL_EVERY = 3;
const BAR_STAGGER = 0.025;

interface Props {
  hours: HourlyPoint[];
  windowStart: number;
  picked: number;
  onPick: (index: number) => void;
}

function useGrow(hours: HourlyPoint[]) {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(
    () =>
      animate(hours.length ? svg.current : null, (k) => {
        k.gsap.from(".bar", {
          scaleY: 0,
          transformOrigin: "50% 100%",
          duration: 0.6,
          ease: EASE,
          stagger: BAR_STAGGER,
        });
        return undefined;
      }),
    [hours],
  );
  return svg;
}

function Labels({ hours }: { hours: HourlyPoint[] }) {
  return (
    <ol className="strip-hours" aria-hidden="true">
      {hours.map((h, i) => (
        <li key={h.time}>{i % LABEL_EVERY === 0 ? hourLabel(h.time) : ""}</li>
      ))}
    </ol>
  );
}

/** Bars, cleanest-window bracket and the picked-hour marker; decorative (aria-hidden). */
export function StripChart({ hours, windowStart, picked, onPick }: Props) {
  const svg = useGrow(hours);
  const width = Math.max(hours.length, 1) * STYLE.slot;
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const index = Math.floor(((e.clientX - box.left) / box.width) * hours.length);
    if (index >= 0 && index < hours.length) onPick(index);
  };
  return (
    <div className="strip-chart" onPointerMove={pick} onPointerDown={pick}>
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${STYLE.plotHeight}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {windowStart >= 0 ? (
          <rect
            className="strip-clean"
            x={windowStart * STYLE.slot + WINDOW_INSET}
            y={0}
            width={WINDOW_HOURS * STYLE.slot - WINDOW_INSET * 2}
            height={STYLE.plotHeight}
            rx={10}
          />
        ) : null}
        {barsFor(hours, STYLE).map((b) => (
          <rect
            key={b.index}
            className={`bar fill-${categoryKey(b.aqi)}${b.index === picked ? " is-picked" : ""}`}
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
            rx={6}
          />
        ))}
      </svg>
      <Labels hours={hours} />
    </div>
  );
}
