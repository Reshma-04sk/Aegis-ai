// The landing story below the live data: the four decisions a plan makes, how Aegis decides,
// and what its numbers are and are not.
import { CONFIG } from "../lib/config";
import { useReveal } from "./useReveal";
import { Method } from "./Method";

const DECISIONS = [
  {
    title: "A call for each person",
    text: "Asthma, a child, an older parent, a pregnancy or a heart condition each make the call stricter. The household follows its most careful member.",
  },
  {
    title: "The right hour for each outing",
    text: "The walk, the match, the errand: each lands in its cleanest forecast hours, with the PM2.5 you skip by waiting.",
  },
  {
    title: "Cleaner air indoors",
    text: "Is the purifier big enough for the room, how fast it clears the air, and the single hour worth opening a window.",
  },
  {
    title: "A greener trip, honestly",
    text: "Carbon saved by switching how you travel, next to the smoke you would breathe doing it. On bad days these pull apart, and Aegis shows both.",
  },
];

function Decisions() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="band decisions" id="covers" aria-labelledby="covers-title">
      <p className="kicker" data-reveal>
        What a plan settles
      </p>
      <h2 id="covers-title" data-reveal>
        One plan, four decisions
      </h2>
      <ol className="decision-list">
        {DECISIONS.map((d, i) => (
          <li key={d.title} data-reveal>
            <span className="decision-number" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3>{d.title}</h3>
            <p>{d.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Trust() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="band trust" id="trust" aria-labelledby="trust-title">
      <h2 id="trust-title" data-reveal>
        What the numbers are, and are not
      </h2>
      <div className="trust-grid">
        <div data-reveal>
          <h3>Forecast</h3>
          <p>
            A model estimate on a regional grid. It covers places with no monitor and looks ahead, so it
            drives the plan. Always labelled as an estimate.
          </p>
        </div>
        <div data-reveal>
          <h3>Measurement</h3>
          <p>
            The nearest official monitor that reported in the last {CONFIG.stationRecentHours} hours, exactly
            as its operator publishes it, with distance and age. Shown beside the forecast, never blended in.
          </p>
        </div>
        <div data-reveal>
          <h3>Age and gaps</h3>
          <p>
            Every value shows how old it is, and anything older than {CONFIG.staleAfterHours} hours is marked
            stale. A missing reading stays missing; nothing is filled in.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Decisions, method and trust, in reading order. */
export function Story() {
  return (
    <>
      <Decisions />
      <Method />
      <Trust />
    </>
  );
}
