// Every number the motion layer uses, named in one place. Durations are seconds (GSAP), distances
// are CSS pixels unless noted.

export const EASE = {
  enter: "power3.out", // things arriving: headlines, panels, result cards
  open: "power2.out", // things opening: rows, sections, bars
  settle: "power2.inOut", // the sky changing to match a plan
  scrub: "none", // scroll-linked timelines follow the scrollbar exactly
};

/** Lenis smooth scrolling and in-page link offsets. */
export const SCROLL = {
  lerp: 0.085, // lower is smoother and slower to catch up
  belowTopbar: 12, // gap left between the sticky top bar and a scrolled-to section
};

/** Headline words rising into place. */
export const HEADLINE = { risePercent: 110, duration: 0.9, stagger: 0.045, delay: 0.1 };

/** Landing copy fading in after the headline. */
export const HERO_COPY = { offset: 16, duration: 0.7, stagger: 0.08, delay: 0.45 };

/** Drifting PM2.5 specks; density 0 is a clear sky, 1 is thick smog. */
export const PARTICLES = {
  colour: "rgb(232, 214, 186)",
  maxSpecks: 140,
  pixelsPerSpeck: 9000, // one speck per this many square pixels of viewport
  maxPixelRatio: 2,
  radius: { min: 0.6, spread: 1.9 },
  driftX: { min: 0.08, spread: 0.25 },
  driftY: { min: -0.05, spread: 0.1 },
  alpha: { min: 0.25, spread: 0.45 },
  wrapMargin: 4, // specks re-enter just off-screen
  idleBelow: 0.02, // below this density nothing is drawn at all
};

/** The landing sky clearing as you read, from the hero to the features section. */
export const SKY_SCRUB = {
  scrub: 0.8,
  end: "top 35%",
  haze: [
    { selector: ".haze-1", opacity: 0, yPercent: -30, at: 0 },
    { selector: ".haze-2", opacity: 0, yPercent: -18, at: 0.1 },
    { selector: ".haze-3", opacity: 0.15, yPercent: -10, at: 0.2 },
  ],
  sun: { opacity: 1, scale: 1.12, yPercent: -60 },
  cityFarOpacity: 0.55,
  cityMidOpacity: 0.8,
  cueFadeDistance: "+=150", // the scroll cue is gone after this much scrolling
};

/** Winter inversion diagram: the warm-air lid lifting as you scroll (SVG user units). */
export const INVERSION = {
  scrub: 0.6,
  lidY: 70,
  labelY: 62,
  smogHeight: 210,
  smogOpacity: 0.35,
  sunY: 70,
  wideScreen: "(min-width: 48rem)",
};

/** The planner sky settling to the plan's real AQI band. Haze level 0 = Good ... 1 = Very Unhealthy+. */
export const SKY_SETTLE = {
  duration: 2.4,
  slowHaze: 2.6,
  slowestHaze: 2.8,
  maxBand: 4, // Very Unhealthy and Hazardous both mean the thickest smog
  clearFade: 0.85,
  haze1: 0.85,
  haze2: 0.8,
  haze3Base: 0.15,
  haze3Range: 0.55,
  sunFade: 0.6,
};

/** Planner panel, background parallax (pixels each layer rises) and pointer glow. */
export const PLANNER = {
  panelRise: 36,
  panelDuration: 0.9,
  parallaxScrub: 1,
  parallax: [
    { selector: ".city-far", y: -18 },
    { selector: ".city-mid", y: -42 },
    { selector: ".city-near", y: -78 },
    { selector: ".trees", y: -104 },
  ],
  sunSinkPercent: 30,
};

/** Rows and optional sections easing open. */
export const OPEN = { rowDrop: -10, rowDuration: 0.45, sectionDrop: -8, sectionDuration: 0.4 };

/** Results rising in, and the forecast bars growing. */
export const RESULTS = {
  glide: 1.1,
  cardRise: 28,
  cardDuration: 0.65,
  cardStagger: 0.08,
  cardsAt: 0.15,
  barDuration: 0.6,
  barStagger: 0.015,
  barsAt: 0.5,
};

/** Custom cursor: how quickly the ring catches up with the pointer (0..1 per frame). */
export const CURSOR = { follow: 0.2, settled: 0.1, offscreen: -100 };
