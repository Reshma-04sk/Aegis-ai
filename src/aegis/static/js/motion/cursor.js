// Custom cursor: a dot exactly on the pointer (so precision is never lost) and a ring that trails
// it and grows over things you can click. Mouse users only; text fields keep the native caret.
import { CURSOR } from "./constants.js";

const CLICKABLE = "a, button, summary, label, [role='button'], .chip";
const TEXT = "input, textarea, select, [contenteditable='true']";

/** @param {string} className */
function layer(className) {
  const node = document.createElement("div");
  node.className = className;
  node.setAttribute("aria-hidden", "true");
  return node;
}

/**
 * Start the custom cursor. Returns a function that removes it again.
 * @returns {() => void}
 */
export function startCursor() {
  const root = document.documentElement;
  const dot = layer("cursor-dot");
  const ring = layer("cursor-ring");
  document.body.append(dot, ring);
  root.classList.add("has-cursor");
  const pointer = { x: CURSOR.offscreen, y: CURSOR.offscreen };
  const trail = { x: CURSOR.offscreen, y: CURSOR.offscreen };
  let frame = 0;

  const follow = () => {
    trail.x += (pointer.x - trail.x) * CURSOR.follow;
    trail.y += (pointer.y - trail.y) * CURSOR.follow;
    ring.style.transform = `translate3d(${trail.x}px, ${trail.y}px, 0)`;
    const moving = Math.abs(pointer.x - trail.x) + Math.abs(pointer.y - trail.y) > CURSOR.settled;
    frame = moving ? requestAnimationFrame(follow) : 0;
  };
  /** @param {PointerEvent} event */
  const move = (event) => {
    if (event.pointerType !== "mouse") return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
    const target = event.target instanceof Element ? event.target : null;
    root.classList.toggle("cursor-text", Boolean(target?.closest(TEXT)));
    root.classList.toggle("cursor-hover", Boolean(target?.closest(CLICKABLE)));
    root.classList.add("cursor-visible");
    if (!frame) frame = requestAnimationFrame(follow);
  };
  const hide = () => root.classList.remove("cursor-visible");

  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerdown", () => root.classList.add("cursor-down"));
  window.addEventListener("pointerup", () => root.classList.remove("cursor-down"));
  document.addEventListener("pointerleave", hide);
  window.addEventListener("blur", hide);
  return () => {
    window.removeEventListener("pointermove", move);
    root.classList.remove("has-cursor", "cursor-visible");
    dot.remove();
    ring.remove();
  };
}
