// Keyboard focus for add/remove row lists: a new row gets focus; removing a row moves focus to
// its neighbour (or the add button), never to <body>.
import { useRef } from "react";
import { flushSync } from "react-dom";

const FIELD = "input, select";
const fieldIn = (row: Element | undefined) => row?.querySelector<HTMLElement>(FIELD) ?? null;

/** Refs for the list and its add button, and wrappers that apply a change then move focus. */
export function useRowFocus() {
  const listRef = useRef<HTMLUListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const added = (change: () => void) => {
    flushSync(change);
    fieldIn(listRef.current?.lastElementChild ?? undefined)?.focus();
  };
  const removed = (index: number, change: () => void) => {
    flushSync(change);
    const rows = [...(listRef.current?.children ?? [])];
    const next = rows[index] ?? rows[index - 1];
    (fieldIn(next) ?? addRef.current)?.focus();
  };
  return { listRef, addRef, added, removed };
}
