import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RecentResults } from "@/components/football/RecentResults";
import { makeFixture, PHYSICAL_DIRECTION } from "./fixtures";

const labels = {
  title: "آخر النتائج", scoredIn: "سجّل في", over25: "أكثر من 2.5 هدف", bothScored: "سجّل كلا الفريقين",
  win: "فوز", draw: "تعادل", loss: "خسارة", atHome: "مستضيف", away: "خارج الديار",
  noResults: "لا توجد نتائج سابقة",
};
const WAC = 968;
const RCA = 967;
const wac = { id: WAC, name: "Wydad AC", logo: "/w.png", winner: null };
const rca = { id: RCA, name: "Raja Casablanca", logo: "/r.png", winner: null };

// Wydad's last five: scored in 2 of them (2-0, 3-3); one 0-1 loss; two 0-0.
const wacForm = [
  makeFixture({ id: 11, homeId: WAC, awayId: 1, home: 0, away: 0, ts: 5 }),
  makeFixture({ id: 12, homeId: 2, awayId: WAC, home: 0, away: 0, ts: 4 }),
  makeFixture({ id: 13, homeId: WAC, awayId: 3, home: 0, away: 1, ts: 3 }),
  makeFixture({ id: 14, homeId: WAC, awayId: 4, home: 2, away: 0, ts: 2 }),
  makeFixture({ id: 15, homeId: 5, awayId: WAC, home: 3, away: 3, ts: 1, leagueId: 999 }), // cup: not indexable
];
const rcaForm = [
  makeFixture({ id: 21, homeId: RCA, awayId: 6, home: 1, away: 0, ts: 5 }),
  makeFixture({ id: 22, homeId: 7, awayId: RCA, home: 2, away: 2, ts: 4 }),
];

describe("RecentResults", () => {
  it("derives the x/N rows from exactly the rendered fixtures", () => {
    const { container } = render(<RecentResults home={{ team: wac, fixtures: wacForm }} away={{ team: rca, fixtures: rcaForm }} locale="ar" labels={labels} />);
    const homeCol = container.querySelector("[data-form-column='home']")!;
    expect(homeCol.querySelectorAll("[data-result]")).toHaveLength(5);
    expect(homeCol.querySelector("[data-stat='scoredIn']")!.getAttribute("data-value")).toBe("2/5");
    expect(homeCol.querySelector("[data-stat='over25']")!.getAttribute("data-value")).toBe("1/5");
    expect(homeCol.querySelector("[data-stat='bothScored']")!.getAttribute("data-value")).toBe("1/5");
    const awayCol = container.querySelector("[data-form-column='away']")!;
    expect(awayCol.querySelectorAll("[data-result]")).toHaveLength(2);
    expect(awayCol.querySelector("[data-stat='scoredIn']")!.getAttribute("data-value")).toBe("2/2");
  });

  it("badges show a letter from the team's perspective with a spoken label", () => {
    const { container } = render(<RecentResults home={{ team: wac, fixtures: wacForm }} away={{ team: rca, fixtures: rcaForm }} locale="ar" labels={labels} />);
    const loss = container.querySelector("[data-result='L']")!;
    expect(loss.textContent).toBe("خ");
    expect(loss.getAttribute("aria-label")).toBe("خسارة");
    expect(container.querySelector("[data-result='W']")!.textContent).toBe("ف");
    expect(container.querySelector("[data-result='D']")!.getAttribute("aria-label")).toBe("تعادل");
  });

  it("links only rows whose match page is indexable; the cup fixture renders as plain text", () => {
    const { container } = render(<RecentResults home={{ team: wac, fixtures: wacForm }} away={{ team: rca, fixtures: rcaForm }} locale="ar" labels={labels} />);
    const links = [...container.querySelectorAll("a[href^='/ar/matches/']")].map((a) => a.getAttribute("href"));
    expect(links).toEqual(["/ar/matches/11", "/ar/matches/12", "/ar/matches/13", "/ar/matches/14", "/ar/matches/21", "/ar/matches/22"]);
    expect(container.querySelector("a[href='/ar/matches/15']")).toBeNull();
    expect(container.querySelector("[data-unlinked-fixture='15']")).not.toBeNull();
  });

  it("labels each row with its competition", () => {
    const { container } = render(<RecentResults home={{ team: wac, fixtures: wacForm }} away={{ team: rca, fixtures: rcaForm }} locale="ar" labels={labels} />);
    expect(container.textContent).toContain("البطولة الاحترافية");
  });

  it("keeps the column's own team out of every row, so the rows do not swap sides", () => {
    const { container } = render(<RecentResults home={{ team: wac, fixtures: wacForm }} away={{ team: rca, fixtures: rcaForm }} locale="ar" labels={labels} />);
    const homeCol = container.querySelector("[data-form-column='home']")!;
    const rows = homeCol.querySelectorAll("li");
    expect(rows).toHaveLength(5);
    for (const r of rows) {
      expect(r.querySelectorAll("[data-opponent]")).toHaveLength(1);
      expect(r.querySelector("[data-venue]")).not.toBeNull();
      expect(r.textContent).not.toContain("Wydad");
    }
  });

  it("shows one empty-state line, not 0/0 statistics, for a team with no results", () => {
    const { container } = render(<RecentResults home={{ team: wac, fixtures: wacForm }} away={{ team: rca, fixtures: [] }} locale="ar" labels={labels} />);
    const awayCol = container.querySelector("[data-form-column='away']")!;
    expect(awayCol.querySelector("[data-empty]")).toHaveTextContent("لا توجد نتائج سابقة");
    expect(awayCol.querySelector("[data-stat]")).toBeNull();
    // The other column is unaffected.
    expect(container.querySelector("[data-form-column='home'] [data-stat='scoredIn']")).not.toBeNull();
  });

  it("renders nothing when neither team has results", () => {
    const { container } = render(<RecentResults home={{ team: wac, fixtures: [] }} away={{ team: rca, fixtures: [] }} locale="ar" labels={labels} />);
    expect(container.innerHTML).toBe("");
  });

  it("RTL: the home column is first in the DOM (visually right under dir=rtl) and no physical direction classes are used", () => {
    const { container } = render(<RecentResults home={{ team: wac, fixtures: wacForm }} away={{ team: rca, fixtures: rcaForm }} locale="ar" labels={labels} />);
    const cols = container.querySelectorAll("[data-form-column]");
    expect(cols[0].getAttribute("data-form-column")).toBe("home");
    expect(cols[1].getAttribute("data-form-column")).toBe("away");
    for (const el of container.querySelectorAll("[class]")) {
      expect(el.className, el.outerHTML.slice(0, 80)).not.toMatch(PHYSICAL_DIRECTION);
    }
  });
});
