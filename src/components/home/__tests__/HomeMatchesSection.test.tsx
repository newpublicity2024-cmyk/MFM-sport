import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import {
  HomeMatchesSection,
  fixturesByDateUrl,
  groupByLeague,
  type LeagueChip,
} from "@/components/home/HomeMatchesSection";
import type { ApiFixture } from "@/lib/api-football/types";

const LABELS = {
  liveNow: "Live Now", events: "Events", venue: "Venue", referee: "Referee",
  viewFullMatch: "View full match", loadingDetails: "Loading...", noEvents: "No events yet",
  allLeagues: "All leagues", leagueFilters: "league filters", dateLabel: "Date", days: "days",
};
const TODAY = "2026-09-17";
const LEAGUES: LeagueChip[] = [
  { id: "200", name: "Botola", logoUrl: "https://x/200.png" },
  { id: "39", name: "Premier League", logoUrl: "https://x/39.png" },
];

function fx(id: number, short: string, ts: number, homeName: string, leagueId = 200): ApiFixture {
  return {
    fixture: {
      id, date: "2026-09-17T19:00:00+00:00", timestamp: ts,
      venue: { id: 1, name: "Stadium", city: "City" },
      status: { long: short, short, elapsed: short === "2H" ? 70 : null },
      referee: null,
    },
    league: { id: leagueId, name: leagueId === 200 ? "Botola" : "Premier League", country: "X", logo: "https://x/l.png", flag: null, season: 2026, round: "R1" },
    teams: {
      home: { id: id * 10, name: homeName, logo: "https://x/h.png", winner: null },
      away: { id: id * 10 + 1, name: "Away " + id, logo: "https://x/a.png", winner: null },
    },
    goals: { home: 1, away: 1 },
    score: {
      halftime: { home: 0, away: 0 }, fulltime: { home: null, away: null },
      extratime: { home: null, away: null }, penalty: { home: null, away: null },
    },
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
const otherDay: Record<string, ApiFixture[]> = {
  "2026-09-18": [fx(9, "NS", 1790000000, "Tomorrow FC", 39)],
};

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    const u = new URL(String(url), "http://x");
    if (u.pathname === "/api/fixtures/date") {
      return { ok: true, json: async () => ({ fixtures: otherDay[u.searchParams.get("date") ?? ""] ?? [] }) } as Response;
    }
    // live endpoint: nothing live
    return { ok: true, json: async () => ({ fixtures: [] }) } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function renderSection(fixtures: ApiFixture[], locale = "en") {
  return render(
    <HomeMatchesSection
      title="Matches" emptyLabel="No matches" locale={locale}
      fixtures={fixtures} today={TODAY} leagues={LEAGUES} labels={LABELS}
    />,
  );
}

describe("groupByLeague", () => {
  it("groups by league in CMS order, live → upcoming → finished inside a group", () => {
    const groups = groupByLeague(
      [fx(1, "FT", 100, "Done", 39), fx(2, "NS", 300, "Soon", 200), fx(3, "2H", 200, "Live", 200), fx(4, "NS", 50, "Unlisted", 999)],
      ["200", "39"],
    );
    expect(groups.map((g) => g.league.id)).toEqual([200, 39, 999]);
    expect(groups[0]!.fixtures.map((f) => f.teams.home.name)).toEqual(["Live", "Soon"]);
  });
});

describe("HomeMatchesSection", () => {
  it("shows the empty state when there are no fixtures", () => {
    renderSection([]);
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("renders the title, a day carousel, a league chip strip and the day's games grouped by league", () => {
    const { container } = renderSection([fx(1, "NS", 200, "Scheduled FC"), fx(2, "2H", 100, "Live FC"), fx(3, "NS", 300, "London FC", 39)]);
    expect(screen.getByRole("heading", { name: "Matches" })).toBeInTheDocument();
    expect(container.querySelector("[data-day-carousel]")).toBeTruthy();
    expect(screen.getByRole("group", { name: "league filters" })).toBeInTheDocument();
    const groups = container.querySelectorAll("[data-league-group]");
    expect(groups.length).toBe(2);
    expect(within(groups[0] as HTMLElement).getByText("Botola")).toBeInTheDocument();
    const names = within(groups[0] as HTMLElement).getAllByText(/FC$/).map((n) => n.textContent);
    expect(names[0]).toBe("Live FC");
    expect(names[1]).toBe("Scheduled FC");
  });

  it("with no league chip selected every game of the day shows; a chip narrows to that league; 'all' restores", () => {
    const { container } = renderSection([fx(1, "NS", 200, "Rabat FC"), fx(3, "NS", 300, "London FC", 39)]);
    expect(container.querySelectorAll("[data-match-row]").length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Premier League" }));
    expect(container.querySelectorAll("[data-match-row]").length).toBe(1);
    expect(screen.getByText("London FC")).toBeInTheDocument();
    expect(screen.queryByText("Rabat FC")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All leagues" }));
    expect(container.querySelectorAll("[data-match-row]").length).toBe(2);
  });

  it("picking another day fetches that day's games once, shows a skeleton meanwhile, and today needs no fetch", async () => {
    const { container } = renderSection([fx(1, "NS", 200, "Rabat FC")]);
    const dateCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/fixtures/date"));
    fireEvent.click(screen.getByRole("button", { name: "2026-09-18" }));
    expect(container.querySelector("[data-matches-loading]")).toBeTruthy();
    expect(dateCalls().map((c) => String(c[0]))).toEqual([fixturesByDateUrl("2026-09-18")]);
    await waitFor(() => expect(screen.getByText("Tomorrow FC")).toBeInTheDocument());
    expect(screen.queryByText("Rabat FC")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: TODAY }));
    expect(screen.getByText("Rabat FC")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2026-09-18" }));
    expect(screen.getByText("Tomorrow FC")).toBeInTheDocument();
    expect(dateCalls().length).toBe(1);
  });

  it("a day with no games shows the empty label", async () => {
    renderSection([fx(1, "NS", 200, "Rabat FC")]);
    fireEvent.click(screen.getByRole("button", { name: "2026-09-19" }));
    await waitFor(() => expect(screen.getByText("No matches")).toBeInTheDocument());
  });

  it("keeps the list in a bounded vertical snap scroller with snap rows", () => {
    const { container } = renderSection([fx(1, "NS", 200, "Alpha FC"), fx(2, "NS", 300, "Beta FC")]);
    const slider = container.querySelector("[data-matches-slider]") as HTMLElement;
    expect(slider.className).toContain("max-h-[32rem]");
    expect(slider.className).toContain("snap-y");
    expect(slider.className).toContain("no-scrollbar");
    slider.querySelectorAll("[data-match-row]").forEach((r) => {
      expect((r as HTMLElement).className).toContain("snap-start");
      expect((r as HTMLElement).className).toContain("shrink-0");
    });
  });
});
