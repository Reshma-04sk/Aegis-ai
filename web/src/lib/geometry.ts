// Pure geometry for the AQI ring and the hourly bar charts (SVG units, no DOM). Graphics built
// from these are decorative: every one is paired with text carrying the same numbers.
import type { Category, HourlyPoint } from "./types";

/** The ring spans 270°, open at the bottom, on the EPA 0–500 scale. */
export const RING = { size: 240, radius: 100, sweep: 270, start: 135, scaleMax: 500 };
const BAND_GAP = 0.006; // fraction of the ring left empty between category bands

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Point on the ring for a fraction of the scale (0 = lower left, 1 = lower right). */
export function ringPoint(f: number): { x: number; y: number } {
  const angle = toRad(RING.start + RING.sweep * f);
  const c = RING.size / 2;
  return { x: c + RING.radius * Math.cos(angle), y: c + RING.radius * Math.sin(angle) };
}

/** SVG path for the ring between fractions a and b, drawn clockwise. */
export function ringArc(a: number, b: number): string {
  const p = ringPoint(a);
  const q = ringPoint(b);
  const large = (b - a) * RING.sweep > 180 ? 1 : 0;
  const r = RING.radius;
  return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
}

/** Share of the ring an AQI value fills, 0–100 (capped at the top of the scale). */
export const ringPercent = (aqi: number): number =>
  Math.round((Math.min(Math.max(aqi, 0), RING.scaleMax) / RING.scaleMax) * 100);

/** One ring segment per EPA band, from the band below's ceiling to this band's ceiling. */
export function ringBands(categories: readonly Category[]): { key: string; d: string }[] {
  let low = 0;
  return categories.map((c) => {
    const high = Math.min(c.max ?? RING.scaleMax, RING.scaleMax) / RING.scaleMax;
    const band = { key: c.key, d: ringArc(low + BAND_GAP, high) };
    low = high;
    return band;
  });
}

export interface ChartStyle {
  slot: number; // horizontal space per hour
  barWidth: number;
  plotHeight: number; // height of the tallest possible bar
  floor: number; // smallest y-axis top, so a clean day still reads as low
  minBar: number;
}

export interface Bar {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  aqi: number;
}

/** Bars for the hours that have an AQI value, scaled to the day's worst hour (or the floor). */
export function barsFor(points: readonly HourlyPoint[], style: ChartStyle): Bar[] {
  const top = Math.max(style.floor, ...points.map((p) => p.us_aqi ?? 0));
  const bars: Bar[] = [];
  points.forEach((p, index) => {
    if (p.us_aqi === null) return;
    const height = Math.max(style.minBar, (p.us_aqi / top) * style.plotHeight);
    const x = index * style.slot + (style.slot - style.barWidth) / 2;
    bars.push({ index, x, y: style.plotHeight - height, width: style.barWidth, height, aqi: p.us_aqi });
  });
  return bars;
}

/** Index of the hour a time window starts at, or -1 when it is outside the points. */
export const windowIndex = (points: readonly HourlyPoint[], start: string | undefined): number =>
  start === undefined ? -1 : points.findIndex((p) => p.time === start);
