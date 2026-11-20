// Result cards for a plan, in reading order. Each card module is a pure builder: data in, DOM out.
import { el } from "./dom.js";
import { renderBriefing } from "./cards/briefing.js";
import { renderCommute, renderIndoor } from "./cards/impact.js";
import { renderMembers } from "./cards/members.js";
import { renderOverview } from "./cards/overview.js";
import { present } from "./cards/present.js";
import { renderSchedule } from "./cards/schedule.js";
import { renderStation } from "./cards/station.js";

/**
 * Every card the plan has; optional cards are left out rather than rendered empty.
 * @param {import("#api").PlanResponse} d
 * @returns {HTMLElement[]}
 */
export function renderPlan(d) {
  return [
    renderOverview(d),
    renderStation(d),
    renderBriefing(d),
    renderMembers(d),
    renderSchedule(d),
    d.indoor && renderIndoor(d.indoor),
    d.commute && renderCommute(d.commute),
    el("p", d.disclaimer, "help disclaimer"),
  ].filter(present);
}
