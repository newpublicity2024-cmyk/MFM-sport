import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StandingsExcerpt } from "@/components/football/StandingsExcerpt";
import { windowRows } from "@/lib/football/standingsExcerpt";
import { makeRow, PHYSICAL_DIRECTION } from "./fixtures";

const labels = {
  caption: "ترتيب البطولة الاحترافية",
  fullStandings: "الترتيب الكامل",
  team: "الفريق", played: "لعب", won: "فوز", drawn: "تعادل", lost: "خسارة",
  goalsFor: "له", goalsAgainst: "عليه", goalDiff: "الفارق", points: "نقاط", form: "آخر 5",
};
const table = Array.from({ length: 16 }, (_, i) => makeRow(i + 1));

describe("StandingsExcerpt", () => {
  it("renders the window rows, highlights exactly the two teams, and names the competition in a caption", () => {
    const rows = windowRows(table, 15, 16);
    const { container } = render(
      <StandingsExcerpt rows={rows} highlightTeamIds={[1500, 1600]} locale="ar" labels={labels} fullStandingsHref="/ar/competition/botola-pro-1" />,
    );
    expect(container.querySelectorAll("tr[data-rank]")).toHaveLength(6);
    expect(container.querySelectorAll("tr[aria-current='true']")).toHaveLength(2);
    expect(container.querySelector("caption")).toHaveTextContent("ترتيب البطولة الاحترافية");
    expect(container.querySelectorAll("th[scope='col']").length).toBeGreaterThanOrEqual(10);
    expect(container.querySelector("[data-block='standings']")).not.toBeNull();
  });

  it("draws a gap row between two far-apart triplets", () => {
    const rows = windowRows(Array.from({ length: 20 }, (_, i) => makeRow(i + 1)), 2, 15);
    const { container } = render(
      <StandingsExcerpt rows={rows} highlightTeamIds={[200, 1500]} locale="ar" labels={labels} fullStandingsHref={null} />,
    );
    expect(container.querySelectorAll("tr[data-rank]")).toHaveLength(6);
    expect(container.querySelectorAll("tr[data-gap]")).toHaveLength(1);
  });

  it("links to the full standings only when a page exists for the league", () => {
    const rows = windowRows(table, 1, 2);
    const { container, rerender } = render(
      <StandingsExcerpt rows={rows} highlightTeamIds={[100, 200]} locale="ar" labels={labels} fullStandingsHref="/ar/competition/botola-pro-1" />,
    );
    expect(container.querySelector("a[href='/ar/competition/botola-pro-1']")).toHaveTextContent("الترتيب الكامل");
    rerender(<StandingsExcerpt rows={rows} highlightTeamIds={[100, 200]} locale="ar" labels={labels} fullStandingsHref={null} />);
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders nothing for an empty window", () => {
    const { container } = render(
      <StandingsExcerpt rows={[]} highlightTeamIds={[1, 2]} locale="ar" labels={labels} fullStandingsHref={null} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("form badges keep their letters and carry a spoken label (never colour alone)", () => {
    const rows = windowRows(table, 1, 2);
    const { container } = render(
      <StandingsExcerpt rows={rows} highlightTeamIds={[100, 200]} locale="ar" labels={labels} fullStandingsHref={null} />,
    );
    const badges = container.querySelectorAll("[role='img'][aria-label]");
    expect(badges.length).toBe(6);
    expect(badges[0].getAttribute("aria-label")).toBe("فوز، تعادل، خسارة، فوز، فوز");
    expect(badges[0].textContent).toBe("WDLWW");
  });

  it("RTL: uses only logical direction classes so the caption and cells mirror under dir=rtl", () => {
    const rows = windowRows(table, 1, 2);
    const { container } = render(
      <StandingsExcerpt rows={rows} highlightTeamIds={[100, 200]} locale="ar" labels={labels} fullStandingsHref={null} />,
    );
    for (const el of container.querySelectorAll("[class]")) {
      expect(el.className, el.outerHTML.slice(0, 80)).not.toMatch(PHYSICAL_DIRECTION);
    }
    expect(container.querySelector("caption")!.className).toContain("text-start");
  });
});
