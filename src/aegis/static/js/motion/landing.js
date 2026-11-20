// Landing page: the smog clears as you read, and the winter inversion diagram plays as you scroll.
import { EASE, HERO_COPY, INVERSION, SKY_SCRUB } from "./constants.js";
import { air } from "./env.js";

/** @typedef {import("./env.js").Kit} Kit */

/**
 * The sky clears between the top of the page and "One plan for everyone at home".
 * @param {Kit} kit
 */
function clearSkyOnScroll({ gsap }) {
  const timeline = gsap.timeline({
    defaults: { ease: EASE.scrub },
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      endTrigger: "#features",
      end: SKY_SCRUB.end,
      scrub: SKY_SCRUB.scrub,
    },
  });
  timeline.to(".sky-clear", { opacity: 1 }, 0);
  SKY_SCRUB.haze.forEach(({ selector, opacity, yPercent, at }) =>
    timeline.to(selector, { opacity, yPercent }, at),
  );
  timeline
    .to(".sun", SKY_SCRUB.sun, 0)
    .to(".city-far", { opacity: SKY_SCRUB.cityFarOpacity }, 0)
    .to(".city-mid", { opacity: SKY_SCRUB.cityMidOpacity }, 0)
    .to(air, { density: 0 }, 0);
  // The cue goes as soon as scrolling starts; autoAlpha hides it fully, so a half-faded,
  // low-contrast cue never lingers on screen.
  gsap.to(".scroll-cue", {
    autoAlpha: 0,
    ease: EASE.scrub,
    scrollTrigger: { trigger: ".hero", start: "top top", end: SKY_SCRUB.cueFadeDistance, scrub: true },
  });
}

/**
 * Winter inversion: the warm-air lid lifts and the smog spreads out as you scroll through.
 * Wide screens scroll through a tall sticky section; small screens just pass by it.
 * @param {Kit} kit
 */
function playInversion({ gsap }) {
  const phases = [...document.querySelectorAll(".phase")];
  const wide = window.matchMedia(INVERSION.wideScreen).matches;
  gsap
    .timeline({
      defaults: { ease: EASE.scrub },
      scrollTrigger: {
        trigger: ".winter",
        start: wide ? "top top" : "top 75%",
        end: wide ? "bottom bottom" : "bottom 25%",
        scrub: INVERSION.scrub,
        onUpdate: (self) => {
          const active = Math.min(phases.length - 1, Math.floor(self.progress * phases.length));
          phases.forEach((p, i) => p.classList.toggle("is-active", i === active));
        },
      },
    })
    .to(".inv-lid", { attr: { y1: INVERSION.lidY, y2: INVERSION.lidY } }, 0)
    .to(".inv-label", { attr: { y: INVERSION.labelY } }, 0)
    .to(
      ".inv-smog",
      { attr: { y: INVERSION.lidY, height: INVERSION.smogHeight }, opacity: INVERSION.smogOpacity },
      0,
    )
    .to(".inv-sun", { attr: { cy: INVERSION.sunY } }, 0)
    .to(".inv-sky", { opacity: 1 }, 0);
}

/**
 * Start the landing page motion: smog first, then it clears as you read.
 * @param {Kit} kit
 */
export function startLanding(kit) {
  air.density = 1;
  kit.gsap.from(".hero-lede, .hero-actions, .hero-note", {
    opacity: 0,
    y: HERO_COPY.offset,
    duration: HERO_COPY.duration,
    ease: EASE.open,
    stagger: HERO_COPY.stagger,
    delay: HERO_COPY.delay,
  });
  clearSkyOnScroll(kit);
  playInversion(kit);
}
