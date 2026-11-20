// The planner form's reducer and the saved household (device storage is untrusted input).
import { describe, expect, test } from "vitest";
import {
  blankHousehold,
  formValues,
  HERE,
  MAX_ACTIVITIES,
  MAX_MEMBERS,
  reduce,
} from "../../web/src/planner/household";
import type { Action, Household } from "../../web/src/planner/household";
import { forget, initialHousehold, save } from "../../web/src/planner/storage";

const run = (actions: Action[], start: Household = blankHousehold("Delhi")) => actions.reduce(reduce, start);
const STORE_KEY = "aegis.household.v1";

describe("reducer", () => {
  test("typing a place drops device coordinates; locating sets them and the 'here' label", () => {
    const located = run([{ type: "coords", coords: { latitude: 28.6, longitude: 77.2 } }]);
    expect(located.place).toBe(HERE);
    expect(run([{ type: "place", value: HERE }], located).coords).not.toBeNull();
    expect(run([{ type: "place", value: "Pune" }], located).coords).toBeNull();
  });

  test("rows are added up to their limits and keep unique keys", () => {
    const people = run(Array.from({ length: MAX_MEMBERS + 2 }, () => ({ type: "addMember" as const })));
    expect(people.members).toHaveLength(MAX_MEMBERS);
    expect(new Set(people.members.map((m) => m.key)).size).toBe(MAX_MEMBERS);
    const plans = run(Array.from({ length: MAX_ACTIVITIES + 1 }, () => ({ type: "addActivity" as const })));
    expect(plans.activities).toHaveLength(MAX_ACTIVITIES);
  });

  test("the last person cannot be removed; plans can all go", () => {
    const h = blankHousehold();
    const memberKey = h.members[0]?.key ?? -1;
    const activityKey = h.activities[0]?.key ?? -1;
    expect(run([{ type: "remove", list: "members", key: memberKey }], h).members).toHaveLength(1);
    expect(run([{ type: "remove", list: "activities", key: activityKey }], h).activities).toHaveLength(0);
    const two = run([{ type: "addMember" }], h);
    expect(run([{ type: "remove", list: "members", key: memberKey }], two).members).toHaveLength(1);
  });

  test("patches touch only their row or section", () => {
    const h = run([{ type: "addMember" }]);
    const key = h.members[1]?.key ?? -1;
    const next = run(
      [
        { type: "member", key, patch: { name: "Gran", groups: ["elderly"] } },
        { type: "activity", key: h.activities[0]?.key ?? -1, patch: { label: "Run" } },
        { type: "home", patch: { area: "15" } },
        { type: "commute", patch: { distance: "8" } },
        { type: "note", value: "hi" },
      ],
      h,
    );
    expect(next.members.map((m) => m.name)).toEqual(["You", "Gran"]);
    expect(next.activities[0]?.label).toBe("Run");
    expect([next.home.area, next.home.ceiling, next.commute.distance, next.note]).toEqual([
      "15",
      "2.7",
      "8",
      "hi",
    ]);
  });

  test("reset keeps a typed place but not 'here', and keys keep increasing", () => {
    const h = run([{ type: "addMember" }, { type: "reset" }]);
    expect(h.place).toBe("Delhi");
    expect(h.members).toHaveLength(1);
    const located = run([{ type: "coords", coords: { latitude: 1, longitude: 2 } }, { type: "reset" }]);
    expect(located.place).toBe("");
    expect(located.coords).toBeNull();
  });

  test("form values drop the row keys", () => {
    const v = formValues(blankHousehold("Delhi"));
    expect(v.members).toEqual([{ name: "You", groups: [] }]);
    expect(v.activities[0]).not.toHaveProperty("key");
    expect(v.location).toBe("Delhi");
  });
});

describe("storage", () => {
  test("a saved household comes back; a landing-page city wins over the saved place", () => {
    const h = run([
      { type: "addMember" },
      { type: "member", key: 2, patch: { name: "Gran", groups: ["elderly"] } },
    ]);
    save(h);
    const restored = initialHousehold();
    expect(restored.place).toBe("Delhi");
    expect(restored.members.map((m) => m.name)).toEqual(["You", "Gran"]);
    expect(new Set([...restored.members, ...restored.activities].map((r) => r.key)).size).toBe(3);
    window.history.replaceState(null, "", "/plan?city=%20Kolkata%20");
    expect(initialHousehold().place).toBe("Kolkata");
    window.history.replaceState(null, "", "/plan");
  });

  test("nothing saved, garbage, or the 'here' label: a blank household", () => {
    expect(initialHousehold()).toEqual(blankHousehold());
    localStorage.setItem(STORE_KEY, "{not json");
    expect(initialHousehold().members).toHaveLength(1);
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ location: HERE, members: [1, null, { name: 7 }], activities: "x" }),
    );
    const h = initialHousehold();
    expect(h.place).toBe("");
    expect(h.members).toEqual([{ name: "", groups: [], key: 2 }]);
    expect(h.activities).toHaveLength(1);
    localStorage.setItem(STORE_KEY, "42");
    expect(initialHousehold().place).toBe("");
  });

  test("saved text is capped and rows are limited", () => {
    const many = Array.from({ length: 12 }, () => ({ name: "x".repeat(500), groups: ["child", 3] }));
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ location: "Delhi", members: many, activities: [{ label: "Walk" }] }),
    );
    const h = initialHousehold();
    expect(h.members).toHaveLength(MAX_MEMBERS);
    expect(h.members[0]?.name).toHaveLength(100);
    expect(h.members[0]?.groups).toEqual(["child"]);
    expect(h.activities[0]).toMatchObject({ label: "Walk", activity: "walk", earliest: "6", latest: "22" });
  });

  test("forget removes the saved household; storage failures never throw", () => {
    save(blankHousehold("Delhi"));
    forget();
    expect(localStorage.getItem(STORE_KEY)).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const original = window.localStorage;
    Object.defineProperty(window, "localStorage", { value: broken, configurable: true });
    try {
      expect(() => {
        save(blankHousehold());
        forget();
      }).not.toThrow();
      expect(initialHousehold()).toEqual(blankHousehold());
    } finally {
      Object.defineProperty(window, "localStorage", { value: original, configurable: true });
    }
  });
});
