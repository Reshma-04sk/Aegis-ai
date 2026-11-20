// Scroll reveal for a section: its marked children ([data-reveal]) rise into place, in order,
// the first time the section scrolls into view. With reduced motion they are simply there.
import { useEffect, useRef } from "react";
import { animate, DURATION, EASE, STAGGER } from "../lib/motion";

const RISE_PX = 36;

/** Ref for the section whose [data-reveal] children animate in on first view. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(
    () =>
      animate(ref.current, (k) => {
        k.gsap.from("[data-reveal]", {
          y: RISE_PX,
          opacity: 0,
          duration: DURATION,
          ease: EASE,
          stagger: STAGGER,
          scrollTrigger: { trigger: ref.current, start: "top 82%", once: true },
        });
        return undefined;
      }),
    [],
  );
  return ref;
}
