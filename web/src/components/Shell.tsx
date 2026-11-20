// The frame every page shares: skip link, top bar, main landmark and footer.
import type { ReactNode } from "react";

export interface NavLink {
  href: string;
  text: string;
  cta?: boolean;
}

/** The shield with two air lines: the Aegis mark (decorative; the link has its own name). */
export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path className="mark-shield" d="M16 2.5 5 6.8v7.9c0 7 4.7 12 11 14.3 6.3-2.3 11-7.3 11-14.3V6.8Z" />
      <path className="mark-air" d="M10 12c2-1.5 4-1.5 6 0s4 1.5 6 0" />
      <path className="mark-air" d="M10 17c2-1.5 4-1.5 6 0s4 1.5 6 0" />
    </svg>
  );
}

function Topbar({ nav, tone }: { nav: NavLink[]; tone: "night" | "day" }) {
  return (
    <header className={`topbar topbar-${tone}`}>
      <a className="brand" href="/" aria-label="Aegis home">
        <Mark />
        <span>Aegis</span>
      </a>
      <nav aria-label="Main">
        {nav.map((link) => (
          <a key={link.href} href={link.href} className={link.cta ? "button button-small" : "nav-link"}>
            {link.text}
          </a>
        ))}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <p>
        Forecasts: Copernicus CAMS via <a href="https://open-meteo.com/">Open-Meteo.com</a> (
        <a href="https://open-meteo.com/en/licence">CC BY 4.0</a>). Measurements:{" "}
        <a href="https://openaq.org/">OpenAQ</a>, credited to each station’s operator. Emission factors: UK
        DESNZ 2026. Breathing rates: US EPA Exposure Factors Handbook. Briefings: Google Gemini, when
        available.
      </p>
      <p>General guidance, not medical advice.</p>
    </footer>
  );
}

/** Skip link, top bar, the page's main content and the footer. */
export function Shell(props: { nav: NavLink[]; tone: "night" | "day"; children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Topbar nav={props.nav} tone={props.tone} />
      <main id="main" tabIndex={-1}>
        {props.children}
      </main>
      <Footer />
    </>
  );
}
