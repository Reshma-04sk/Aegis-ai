// Drifting specks of "PM2.5" on a canvas behind the page. Their density follows air.density.
import { PARTICLES } from "./constants.js";
import { air } from "./env.js";

/** @typedef {import("./env.js").Kit} Kit */
/** @typedef {{ x: number, y: number, r: number, vx: number, vy: number, a: number }} Speck */

/** @param {{ min: number, spread: number }} range */
const random = ({ min, spread }) => min + Math.random() * spread;

/**
 * @param {number} width
 * @param {number} height
 * @returns {Speck[]}
 */
function scatter(width, height) {
  const count = Math.round(Math.min(PARTICLES.maxSpecks, (width * height) / PARTICLES.pixelsPerSpeck));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: random(PARTICLES.radius),
    vx: random(PARTICLES.driftX),
    vy: random(PARTICLES.driftY),
    a: random(PARTICLES.alpha),
  }));
}

/**
 * Move one speck, wrapping it around the edges.
 * @param {Speck} s
 * @param {number} width
 * @param {number} height
 */
function drift(s, width, height) {
  const m = PARTICLES.wrapMargin;
  s.x += s.vx;
  s.y += s.vy;
  if (s.x > width + m) s.x = -m;
  if (s.y < -m) s.y = height + m;
  if (s.y > height + m) s.y = -m;
}

/**
 * Start the particle layer. Returns a function that stops it and clears the canvas.
 * @param {Kit} kit
 * @param {HTMLCanvasElement} canvas
 * @returns {() => void}
 */
export function startParticles({ gsap }, canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const size = { width: 0, height: 0 };
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, PARTICLES.maxPixelRatio);
    size.width = canvas.clientWidth;
    size.height = canvas.clientHeight;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);
  const specks = scatter(size.width, size.height);
  // A clear sky skips drawing entirely: clearing an empty canvas every frame would still
  // repaint it, and that forces the glass panels above it to re-blur on every frame.
  let blank = false;
  const draw = () => {
    if (air.density < PARTICLES.idleBelow) {
      if (!blank) ctx.clearRect(0, 0, size.width, size.height);
      blank = true;
      return;
    }
    blank = false;
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = PARTICLES.colour;
    specks.forEach((s) => {
      drift(s, size.width, size.height);
      ctx.globalAlpha = s.a * air.density;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  };
  gsap.ticker.add(draw);
  return () => {
    gsap.ticker.remove(draw);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
