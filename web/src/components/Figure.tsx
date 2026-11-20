// A big number with a small unit. It renders its final value; with motion on, it counts up to it.
import { useEffect, useRef } from "react";
import { animate, countUp, figureText } from "../lib/motion";

/** Number and unit as one line of text, e.g. "170 US AQI". */
export function Figure(props: { value: number; unit: string; digits?: number; className?: string }) {
  const { value, unit, digits = 0, className = "" } = props;
  const number = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      animate(number.current, (k) =>
        number.current ? countUp(k, number.current, { target: value, digits }) : undefined,
      ),
    [value, digits],
  );
  return (
    <p className={`figure ${className}`.trim()}>
      <span ref={number} className="figure-value">
        {figureText(value, digits)}
      </span>{" "}
      <span className="figure-unit">{unit}</span>
    </p>
  );
}
