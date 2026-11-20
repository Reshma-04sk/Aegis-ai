// The planner form's state: the place, the household members, their outdoor plans, the room and
// the commute. One reducer, one small handler per action; no DOM.
import type { FormValues } from "../lib/types";

export const MAX_MEMBERS = 8;
export const MAX_ACTIVITIES = 6;
export const HERE = "My current location";

type Coords = NonNullable<FormValues["coords"]>;
export type MemberRow = FormValues["members"][number] & { key: number };
export type ActivityRow = FormValues["activities"][number] & { key: number };

export interface Household {
  place: string;
  coords: Coords | null;
  members: MemberRow[];
  activities: ActivityRow[];
  home: FormValues["home"];
  commute: FormValues["commute"];
  note: string;
  nextKey: number;
}

export const DEFAULT_MEMBER = { name: "You", groups: [] as string[] };
export const DEFAULT_ACTIVITY = {
  label: "Walk",
  activity: "walk",
  duration: "1",
  earliest: "6",
  latest: "22",
};

export type Action =
  | { type: "place"; value: string }
  | { type: "coords"; coords: Coords }
  | { type: "addMember" }
  | { type: "addActivity" }
  | { type: "remove"; list: "members" | "activities"; key: number }
  | { type: "member"; key: number; patch: Partial<MemberRow> }
  | { type: "activity"; key: number; patch: Partial<ActivityRow> }
  | { type: "home"; patch: Partial<FormValues["home"]> }
  | { type: "commute"; patch: Partial<FormValues["commute"]> }
  | { type: "note"; value: string }
  | { type: "reset" };

type Handlers = { [T in Action["type"]]: (s: Household, a: Extract<Action, { type: T }>) => Household };

const patchRow = <R extends { key: number }>(rows: R[], key: number, patch: Partial<R>): R[] =>
  rows.map((r) => (r.key === key ? { ...r, ...patch } : r));

/** A household with one person and one walk, optionally for a given place. */
export function blankHousehold(place = ""): Household {
  return {
    place,
    coords: null,
    members: [{ ...DEFAULT_MEMBER, key: 0 }],
    activities: [{ ...DEFAULT_ACTIVITY, key: 1 }],
    home: { area: "", ceiling: "2.7", cadr: "", unit: "m3h" },
    commute: { distance: "", mode: "car_petrol", occupants: "1", trips: "10" },
    note: "",
    nextKey: 2,
  };
}

const HANDLERS: Handlers = {
  // Typing a place drops any device coordinates.
  place: (s, a) => ({ ...s, place: a.value, coords: a.value === HERE ? s.coords : null }),
  coords: (s, a) => ({ ...s, coords: a.coords, place: HERE }),
  addMember: (s) =>
    s.members.length >= MAX_MEMBERS
      ? s
      : { ...s, members: [...s.members, { name: "", groups: [], key: s.nextKey }], nextKey: s.nextKey + 1 },
  addActivity: (s) =>
    s.activities.length >= MAX_ACTIVITIES
      ? s
      : {
          ...s,
          activities: [...s.activities, { ...DEFAULT_ACTIVITY, label: "", key: s.nextKey }],
          nextKey: s.nextKey + 1,
        },
  // The last person cannot be removed: a plan always has someone in it.
  remove: (s, a) =>
    a.list === "members" && s.members.length === 1
      ? s
      : { ...s, [a.list]: (s[a.list] as { key: number }[]).filter((r) => r.key !== a.key) },
  member: (s, a) => ({ ...s, members: patchRow(s.members, a.key, a.patch) }),
  activity: (s, a) => ({ ...s, activities: patchRow(s.activities, a.key, a.patch) }),
  home: (s, a) => ({ ...s, home: { ...s.home, ...a.patch } }),
  commute: (s, a) => ({ ...s, commute: { ...s.commute, ...a.patch } }),
  note: (s, a) => ({ ...s, note: a.value }),
  reset: (s) => ({ ...blankHousehold(s.place === HERE ? "" : s.place), nextKey: s.nextKey }),
};

/** Apply one form action. */
export function reduce(state: Household, action: Action): Household {
  const handler = HANDLERS[action.type] as (s: Household, a: Action) => Household;
  return handler(state, action);
}

/** The form as plain values for buildPayload (row keys dropped). */
export function formValues(h: Household): FormValues {
  return {
    coords: h.coords,
    location: h.place,
    members: h.members.map(({ name, groups }) => ({ name, groups })),
    activities: h.activities.map(({ label, activity, duration, earliest, latest }) => ({
      label,
      activity,
      duration,
      earliest,
      latest,
    })),
    home: h.home,
    commute: h.commute,
    note: h.note,
  };
}
