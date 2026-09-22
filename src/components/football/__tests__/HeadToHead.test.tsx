import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HeadToHead } from "@/components/football/HeadToHead";
import { localizeTeam } from "@/lib/api-football/localize";
import { makeFixture, PHYSICAL_DIRECTION } from "./fixtures";

const labels = { title: "المواجهات المباشرة (آخر 5 مباريات)", wins: "انتصارات", draws: "تعادلات", goals: "أهداف", win: "فوز", draw: "تعادل", loss: "خسارة", atHome: "مستضيف", away: "خارج الديار" };
const NC = 90001;
const PAT = 90002;
const nc = { id: NC, name: "Nueva Chicago", logo: "/nc.png", winner: null };
const pat = { id: PAT, name: "Patronato", logo: "/pat.png", winner: null };

// Kooora's five meetings: NC 2 wins, 2 draws, PAT 1 win.
const meetings = [
  makeFixture({ id: 31, homeId: PAT, awayId: NC, home: 1, away: 2, ts: 5 }),
  makeFixture({ id: 32, homeId: NC, awayId: PAT, home: 1, away: 1, ts: 4 }),
  makeFixture({ id: 33, homeId: PAT, awayId: NC, home: 0, away: 0, ts: 3, leagueId: 999 }),
  makeFixture({ id: 34, homeId: NC, awayId: PAT, home: 2, away: 0, ts: 2 }),
  makeFixture({ id: 35, homeId: PAT, awayId: NC, home: 2, away: 0, ts: 1 }),
];

describe("HeadToHead", () => {
  it("counts wins per team regardless of home/away and sums to the rows rendered", () => {
    const { container } = render(<HeadToHead fixtures={meetings} teamA={nc} teamB={pat} locale="ar" labels={labels} />);
    const v = (k: string) => Number(container.querySelector(`[data-h2h='${k}']`)!.getAttribute("data-value"));
    expect([v("winsA"), v("draws"), v("winsB")]).toEqual([2, 2, 1]);
    expect(container.querySelectorAll("[data-h2h-row]")).toHaveLength(5);
    expect(v("winsA") + v("draws") + v("winsB")).toBe(5);
  });

  it("describes the goals bar for screen readers with both totals", () => {
    const { container } = render(<HeadToHead fixtures={meetings} teamA={nc} teamB={pat} locale="ar" labels={labels} />);
    const bar = container.querySelector("[role='img'][aria-label*='أهداف']")!;
    expect(bar.getAttribute("aria-label")).toContain("5");
    expect(bar.getAttribute("aria-label")).toContain("4");
  });

  it("keeps team A in the first slot in every row, whoever hosted", () => {
    const { container } = render(<HeadToHead fixtures={meetings} teamA={nc} teamB={pat} locale="ar" labels={labels} />);
    const rows = container.querySelectorAll("[data-h2h-row]");
    expect(rows).toHaveLength(5);
    for (const r of rows) {
      expect(r.querySelector("[data-slot='first']")!.textContent).toContain(localizeTeam(NC, `Team ${NC}`, "ar"));
      expect(r.querySelector("[data-slot='second']")!.textContent).toContain(localizeTeam(PAT, `Team ${PAT}`, "ar"));
      expect(r.querySelector("[data-venue]")).not.toBeNull();
    }
    // Scores follow the slots: NC 2–1 PAT even though PAT hosted that one.
    expect(rows[0]!.querySelector("[data-score]")!.getAttribute("data-score")).toBe("2-1");
  });

  it("links only indexable meetings", () => {
    const { container } = render(<HeadToHead fixtures={meetings} teamA={nc} teamB={pat} locale="ar" labels={labels} />);
    expect(container.querySelectorAll("a[href^='/ar/matches/']")).toHaveLength(4);
    expect(container.querySelector("[data-unlinked-fixture='33']")).not.toBeNull();
  });

  it("renders nothing for a first meeting", () => {
    const { container } = render(<HeadToHead fixtures={[]} teamA={nc} teamB={pat} locale="ar" labels={labels} />);
    expect(container.innerHTML).toBe("");
  });

  it("RTL: team A's counter comes first in the DOM (right edge under dir=rtl) and no physical direction classes are used", () => {
    const { container } = render(<HeadToHead fixtures={meetings} teamA={nc} teamB={pat} locale="ar" labels={labels} />);
    const counters = [...container.querySelectorAll("[data-h2h]")].map((e) => e.getAttribute("data-h2h"));
    expect(counters).toEqual(["winsA", "draws", "winsB"]);
    for (const el of container.querySelectorAll("[class]")) {
      expect(el.className, el.outerHTML.slice(0, 80)).not.toMatch(PHYSICAL_DIRECTION);
    }
  });
});
