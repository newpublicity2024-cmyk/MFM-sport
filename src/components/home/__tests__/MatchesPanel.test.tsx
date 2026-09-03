import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/hooks/useLiveFixtures", () => ({
  useLiveFixtures: () => ({ fixtures: [] }),
}));

import { MatchesPanel } from "@/components/home/MatchesPanel";

const statusLabels = { finished: "FT", live: "LIVE", scheduled: "SCH" };

// Botola (id 200) + another league. Which group auto-opens is now the caller's
// choice (the featured competition), not a league id baked into the component.
function fixture(id: number, leagueId: number, leagueName: string, country: string) {
  return {
    fixture: {
      id,
      date: "2026-06-10T18:00:00Z",
      timestamp: id,
      venue: null,
      status: { long: "", short: "NS", elapsed: null },
      referee: null,
    },
    league: { id: leagueId, name: leagueName, country, logo: "", flag: null, season: 2026, round: "R" },
    teams: {
      home: { id: 1, name: "Home", logo: "", winner: null },
      away: { id: 2, name: "Away", logo: "", winner: null },
    },
    goals: { home: null, away: null },
    score: {
      halftime: { home: null, away: null },
      fulltime: { home: null, away: null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  } as never;
}

const fixtures = [
  fixture(1, 200, "Botola Pro", "Morocco"),
  fixture(2, 39, "Premier League", "England"),
];

describe("MatchesPanel", () => {
  it("starts with ALL league groups collapsed when no featured league is given", () => {
    const { container } = render(
      <MatchesPanel fixtures={fixtures} locale="en" statusLabels={statusLabels} />,
    );
    const toggles = container.querySelectorAll("button[aria-expanded]");
    expect(toggles.length).toBeGreaterThan(0);
    toggles.forEach((t) => expect(t.getAttribute("aria-expanded")).toBe("false"));
  });

  it("renders the league groups inside a mobile vertical snap slider (5 rows)", () => {
    const { container } = render(
      <MatchesPanel fixtures={fixtures} locale="en" statusLabels={statusLabels} />,
    );
    const slider = container.querySelector("[data-leagues-slider]") as HTMLElement;
    expect(slider).toBeTruthy();
    expect(slider.className).toContain("max-h-[19rem]");
    expect(slider.className).toContain("snap-y");
    expect(slider.className).toContain("no-scrollbar");
    expect(slider.className).toContain("lg:max-h-none");
    // Each league row must keep its full height (shrink-0): otherwise flexbox
    // squishes the many rows to ~0px and nothing is visible.
    const rows = slider.querySelectorAll(":scope > div");
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => expect((r as HTMLElement).className).toContain("shrink-0"));
  });

  it("auto-opens only the featured competition's group", () => {
    const { container } = render(
      <MatchesPanel
        fixtures={fixtures}
        locale="en"
        statusLabels={statusLabels}
        openLeagueId={39}
      />,
    );
    const toggles = Array.from(container.querySelectorAll("button[aria-expanded]"));
    const expanded = toggles.filter((t) => t.getAttribute("aria-expanded") === "true");
    expect(expanded).toHaveLength(1);
    expect(expanded[0].textContent).toContain("Premier League");
  });

  it("opens nothing when the featured league has no fixtures in the panel", () => {
    const { container } = render(
      <MatchesPanel
        fixtures={fixtures}
        locale="en"
        statusLabels={statusLabels}
        openLeagueId={999}
      />,
    );
    const toggles = container.querySelectorAll("button[aria-expanded]");
    toggles.forEach((t) => expect(t.getAttribute("aria-expanded")).toBe("false"));
  });

  it("orders league groups by the CMS display order, overriding the name heuristic", () => {
    // Without leagueOrder the heuristic puts Morocco first. An editor who ranks
    // the Premier League above Botola must win — that is the whole point of
    // making the featured league a CMS field.
    const { container } = render(
      <MatchesPanel
        fixtures={fixtures}
        locale="en"
        statusLabels={statusLabels}
        leagueOrder={{ 39: 0, 200: 5 }}
      />,
    );
    const headings = Array.from(container.querySelectorAll("button[aria-expanded]")).map(
      (t) => t.textContent ?? "",
    );
    expect(headings[0]).toContain("Premier League");
    expect(headings[1]).toContain("Botola");
  });

  it("ranks leagues the CMS does not list below every league it does", () => {
    const { container } = render(
      <MatchesPanel
        fixtures={fixtures}
        locale="en"
        statusLabels={statusLabels}
        leagueOrder={{ 39: 50 }}
      />,
    );
    const headings = Array.from(container.querySelectorAll("button[aria-expanded]")).map(
      (t) => t.textContent ?? "",
    );
    expect(headings[0]).toContain("Premier League");
    expect(headings[1]).toContain("Botola");
  });

  it("uses the CMS crest for a league when one is configured", () => {
    const { container } = render(
      <MatchesPanel
        fixtures={fixtures}
        locale="en"
        statusLabels={statusLabels}
        logoOverrides={{ 200: "/images/botola.png" }}
      />,
    );
    const srcs = Array.from(container.querySelectorAll("img")).map((i) =>
      i.getAttribute("src"),
    );
    expect(srcs.some((src) => src?.includes("botola.png"))).toBe(true);
  });
});
