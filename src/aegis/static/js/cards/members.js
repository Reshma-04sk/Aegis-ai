// Members card: one verdict with reasons and actions per person.
import { card, el, list, verdictBadge } from "../dom.js";

/**
 * Who should do what, one article per household member.
 * @param {import("#api").PlanResponse} d
 */
export function renderMembers(d) {
  const section = card("Who should do what");
  const grid = el("div", undefined, "members-grid");
  d.members.forEach((m) => {
    const art = el("article", undefined, `member verdict-border-${m.verdict}`);
    art.append(el("h3", m.name), verdictBadge(m.verdict), list(m.reasons, "reasons"), list(m.actions));
    grid.append(art);
  });
  section.append(grid);
  return section;
}
