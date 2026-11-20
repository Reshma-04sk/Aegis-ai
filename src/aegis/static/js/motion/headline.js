// Headlines whose words rise into place once. The heading keeps its full text as its name.
import { EASE, HEADLINE } from "./constants.js";

/** @typedef {import("./env.js").Kit} Kit */

/**
 * Wrap each word in a clipped span so it can rise from below its own line.
 * @param {Element} heading
 */
function splitWords(heading) {
  const text = (heading.textContent ?? "").trim();
  const words = text.split(/\s+/);
  heading.setAttribute("aria-label", text);
  heading.replaceChildren(
    ...words.flatMap((word, i) => {
      const outer = document.createElement("span");
      const inner = document.createElement("span");
      outer.className = "word";
      outer.setAttribute("aria-hidden", "true");
      inner.textContent = word;
      outer.append(inner);
      return i < words.length - 1 ? [outer, document.createTextNode(" ")] : [outer];
    }),
  );
}

/**
 * Reveal every `.reveal-words` heading on the page.
 * @param {Kit} kit
 */
export function revealHeadlines({ gsap }) {
  document.querySelectorAll(".reveal-words").forEach((heading) => {
    splitWords(heading);
    gsap.from(heading.querySelectorAll(".word > span"), {
      yPercent: HEADLINE.risePercent,
      duration: HEADLINE.duration,
      ease: EASE.enter,
      stagger: HEADLINE.stagger,
      delay: HEADLINE.delay,
    });
  });
}
