// The haze layer behind the hero (decorative, aria-hidden). Rendered empty on the server; the
// painter starts in the browser once the forecast PM2.5 is known.
import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion";
import { startHaze } from "./haze";

/** A full-bleed canvas whose particle density follows the forecast PM2.5 (µg/m³). */
export function HazeCanvas({ pm25 }: { pm25: number | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current || pm25 === null) return undefined;
    return startHaze(canvas.current, pm25, prefersReducedMotion());
  }, [pm25]);
  return <canvas ref={canvas} className="haze" aria-hidden="true" />;
}
