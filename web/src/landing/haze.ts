// The hero's haze: soft particles drifting on a canvas, more of them on a dirtier day. Density
// follows the forecast PM2.5 (square-root scaled and capped, so it stays readable and cheap).
// Purely decorative; it pauses off screen and in background tabs, and is drawn once, still,
// for visitors who prefer reduced motion.

interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
}

const MIN_MOTES = 14;
const MAX_MOTES = 220;
const MOTES_PER_SQRT_UG = 14;

/** How many particles to draw for a PM2.5 value in µg/m³. */
export const moteCount = (pm25: number): number =>
  Math.round(Math.min(MAX_MOTES, Math.max(MIN_MOTES, Math.sqrt(Math.max(pm25, 0)) * MOTES_PER_SQRT_UG)));

function spawn(width: number, height: number): Mote {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    r: 0.6 + Math.random() * 2.4,
    vx: 0.08 + Math.random() * 0.22,
    vy: (Math.random() - 0.5) * 0.08,
    alpha: 0.15 + Math.random() * 0.45,
  };
}

function draw(ctx: CanvasRenderingContext2D, motes: Mote[], tint: string) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = tint;
  for (const m of motes) {
    ctx.globalAlpha = m.alpha;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }
}

function step(motes: Mote[], width: number, height: number) {
  for (const m of motes) {
    m.x = (m.x + m.vx * devicePixelRatio + width) % width;
    m.y = (m.y + m.vy * devicePixelRatio + height) % height;
  }
}

/** Start painting; returns a stop function that cancels the frame loop and its observers. */
export function startHaze(canvas: HTMLCanvasElement, pm25: number, still: boolean): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const motes = Array.from({ length: moteCount(pm25) }, () => spawn(canvas.width, canvas.height));
  const tint = getComputedStyle(canvas).color;
  draw(ctx, motes, tint);
  if (still) return () => undefined;
  let frame = 0;
  let visible = true;
  const loop = () => {
    step(motes, canvas.width, canvas.height);
    draw(ctx, motes, tint);
    frame = requestAnimationFrame(loop);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    cancelAnimationFrame(frame);
    if (visible && !document.hidden) frame = requestAnimationFrame(loop);
  });
  observer.observe(canvas);
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
