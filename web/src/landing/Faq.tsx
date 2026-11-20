// Questions, as native <details> (keyboard operable without script), then the closing call to act.
import { CONFIG } from "../lib/config";

const QUESTIONS: [string, string][] = [
  [
    "Is this medical advice?",
    "No. Aegis turns public air-quality data and published guidance into a daily plan. Your doctor’s advice and your local health authority’s alerts come first; for chest pain or severe breathlessness, seek care.",
  ],
  [
    "Where does the data come from?",
    "Forecasts: the Copernicus Atmosphere Monitoring Service, through Open-Meteo. Measurements: OpenAQ, which carries government networks such as India’s CPCB. Google Gemini only writes the briefing text.",
  ],
  [
    "What happens to my household details?",
    "Your browser keeps them so you don’t retype them. A plan request holds them in server memory for at most five minutes to write the briefing; they are never stored or logged. Keep names out of the free-text note, which the AI reads.",
  ],
  [
    "Does it work outside India?",
    `Yes. The forecast is global, and the measured card appears wherever OpenAQ has a monitor within ${CONFIG.stationRadiusKm} km.`,
  ],
  [
    "Why can forecast and monitor disagree?",
    "A monitor measures one spot, and a busy road or a fire nearby moves it. The forecast estimates a wider area. Aegis shows both and plans with the forecast because it looks ahead.",
  ],
];

/** The questions people ask before trusting a plan. */
export function Faq() {
  return (
    <section className="band faq" id="faq" tabIndex={-1} aria-labelledby="faq-title">
      <h2 id="faq-title">Questions</h2>
      {QUESTIONS.map(([question, answer]) => (
        <details key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </section>
  );
}

/** The last word: one button into the planner for the city on screen. */
export function FinalCta({ city }: { city: string }) {
  return (
    <section className="final" aria-labelledby="final-title">
      <h2 id="final-title">Know who goes out, and when.</h2>
      <p>Two minutes to add your household. The plan stays on this device.</p>
      <a className="button button-large" href={`/plan?city=${encodeURIComponent(city)}`}>
        Build {city}’s plan
      </a>
    </section>
  );
}
