// Type guard used when assembling optional cards and rows.

/**
 * True for anything a card list should keep (drops null, undefined and false).
 * @template T
 * @param {T | null | undefined | false} x
 * @returns {x is T}
 */
export const present = (x) => x !== null && x !== undefined && x !== false;
