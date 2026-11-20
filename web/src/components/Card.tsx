// A titled region: a <section> labelled by its own heading (so it is a landmark for screen readers).
import { useId } from "react";
import type { ReactNode } from "react";

/** Section with an h2 heading that names it. */
export function Card(props: { title: string; className?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={`card ${props.className ?? ""}`.trim()} aria-labelledby={id}>
      <h2 id={id}>{props.title}</h2>
      {props.children}
    </section>
  );
}
