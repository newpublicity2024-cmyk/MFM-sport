import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { makeFixture, makeRow } from "./fixtures";

const getStandingsGroups = vi.fn();
const getCompetitionByApiFootballId = vi.fn();
const getFixturesByTeam = vi.fn();
const getHeadToHead = vi.fn();

vi.mock("@/lib/api-football/standings", () => ({ getStandingsGroups: (...a: unknown[]) => getStandingsGroups(...a) }));
vi.mock("@/lib/payload/queries", () => ({ getCompetitionByApiFootballId: (...a: unknown[]) => getCompetitionByApiFootballId(...a) }));
vi.mock("@/lib/api-football/fixtures", () => ({ getFixturesByTeam: (...a: unknown[]) => getFixturesByTeam(...a) }));
vi.mock("@/lib/api-football/headToHead", () => ({ getHeadToHead: (...a: unknown[]) => getHeadToHead(...a) }));

import { StandingsExcerptBlock } from "@/components/football/blocks/StandingsExcerptBlock";
import { RecentResultsBlock } from "@/components/football/blocks/RecentResultsBlock";
import { HeadToHeadBlock } from "@/components/football/blocks/HeadToHeadBlock";

const WAC = 968;
const RCA = 967;
const fixture = makeFixture({ id: 500, homeId: WAC, awayId: RCA, home: null, away: null, status: "NS", ts: 100 });

const standingsLabels = {
  captionTemplate: (c: string) => `ترتيب ${c}`,
  fullStandings: "الترتيب الكامل",
  team: "الفريق", played: "لعب", won: "فوز", drawn: "تعادل", lost: "خسارة",
  goalsFor: "له", goalsAgainst: "عليه", goalDiff: "الفارق", points: "نقاط", form: "آخر 5",
};
const resultLabels = { win: "فوز", draw: "تعادل", loss: "خسارة" };
const resultsLabels = { ...resultLabels, title: "آخر النتائج", scoredIn: "سجّل في", over25: "أكثر من 2.5", bothScored: "كلاهما سجّل" };
const h2hLabels = { ...resultLabels, title: "المواجهات", wins: "انتصارات", draws: "تعادلات", goals: "أهداف" };

async function renderBlock(el: Promise<React.ReactElement | null>) {
  const node = await el;
  return render(<>{node}</>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("StandingsExcerptBlock", () => {
  const table = [Array.from({ length: 16 }, (_, i) => makeRow(i + 1, i === 0 ? WAC : i === 1 ? RCA : (i + 1) * 100))];

  it("renders the excerpt with a link to the league's standings page", async () => {
    getStandingsGroups.mockResolvedValue(table);
    getCompetitionByApiFootballId.mockResolvedValue({ slug: "botola-pro-1", type: "league", name: "x" });
    const { container } = await renderBlock(StandingsExcerptBlock({ fixture, locale: "ar", labels: standingsLabels }));
    expect(container.querySelectorAll("tr[data-rank]")).toHaveLength(6);
    expect(container.querySelector("a[href='/ar/competition/botola-pro-1']")).not.toBeNull();
    expect(getStandingsGroups).toHaveBeenCalledWith(200, 2026);
  });

  it("omits the link when the CMS competition is a cup (its page has no table)", async () => {
    getStandingsGroups.mockResolvedValue(table);
    getCompetitionByApiFootballId.mockResolvedValue({ slug: "coupe", type: "cup", name: "x" });
    const { container } = await renderBlock(StandingsExcerptBlock({ fixture, locale: "ar", labels: standingsLabels }));
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders nothing when the teams are not in one group (no table, or a cross-group tie)", async () => {
    getStandingsGroups.mockResolvedValue([]);
    getCompetitionByApiFootballId.mockResolvedValue(null);
    const { container } = await renderBlock(StandingsExcerptBlock({ fixture, locale: "ar", labels: standingsLabels }));
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing, not an error, when upstream throws", async () => {
    getStandingsGroups.mockRejectedValue(new Error("quota"));
    getCompetitionByApiFootballId.mockResolvedValue(null);
    const { container } = await renderBlock(StandingsExcerptBlock({ fixture, locale: "ar", labels: standingsLabels }));
    expect(container.innerHTML).toBe("");
  });
});

describe("RecentResultsBlock", () => {
  it("shows the last five played matches per team, newest first, excluding the fixture itself and unplayed ones", async () => {
    const played = (teamId: number) => [
      makeFixture({ id: 500, homeId: teamId, awayId: 1, home: null, away: null, status: "NS", ts: 100 }), // this fixture
      makeFixture({ id: 1, homeId: teamId, awayId: 2, home: 1, away: 0, ts: 1 }),
      makeFixture({ id: 6, homeId: teamId, awayId: 3, home: 2, away: 0, ts: 6 }),
      makeFixture({ id: 2, homeId: 4, awayId: teamId, home: 0, away: 0, ts: 2 }),
      makeFixture({ id: 3, homeId: teamId, awayId: 5, home: 0, away: 1, ts: 3 }),
      makeFixture({ id: 4, homeId: 6, awayId: teamId, home: 1, away: 1, ts: 4 }),
      makeFixture({ id: 5, homeId: teamId, awayId: 7, home: 3, away: 0, ts: 5 }),
      makeFixture({ id: 7, homeId: teamId, awayId: 8, home: null, away: null, status: "PST", ts: 7 }),
    ];
    getFixturesByTeam.mockImplementation((teamId: number) => Promise.resolve(played(teamId)));
    const { container } = await renderBlock(RecentResultsBlock({ fixture, locale: "ar", labels: resultsLabels }));
    const home = container.querySelector("[data-form-column='home']")!;
    const hrefs = [...home.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/ar/matches/6", "/ar/matches/5", "/ar/matches/4", "/ar/matches/3", "/ar/matches/2"]);
    expect(getFixturesByTeam).toHaveBeenCalledWith(WAC, 2026, { last: 6 });
    expect(getFixturesByTeam).toHaveBeenCalledWith(RCA, 2026, { last: 6 });
  });

  it("renders nothing when upstream throws", async () => {
    getFixturesByTeam.mockRejectedValue(new Error("timeout"));
    const { container } = await renderBlock(RecentResultsBlock({ fixture, locale: "ar", labels: resultsLabels }));
    expect(container.innerHTML).toBe("");
  });
});

describe("HeadToHeadBlock", () => {
  it("asks for one extra meeting so the fixture itself can be dropped once played", async () => {
    getHeadToHead.mockResolvedValue([
      makeFixture({ id: 500, homeId: WAC, awayId: RCA, home: 2, away: 1, ts: 100 }),
      makeFixture({ id: 41, homeId: RCA, awayId: WAC, home: 0, away: 0, ts: 41 }),
      makeFixture({ id: 40, homeId: WAC, awayId: RCA, home: 1, away: 0, ts: 40 }),
    ]);
    const { container } = await renderBlock(HeadToHeadBlock({ fixture, locale: "ar", labels: h2hLabels }));
    expect(getHeadToHead).toHaveBeenCalledWith(WAC, RCA, 6);
    expect(container.querySelectorAll("[data-h2h-row]")).toHaveLength(2);
    expect(container.querySelector("a[href='/ar/matches/500']")).toBeNull();
  });

  it("renders nothing for a first meeting or when upstream throws", async () => {
    getHeadToHead.mockResolvedValue([]);
    expect((await renderBlock(HeadToHeadBlock({ fixture, locale: "ar", labels: h2hLabels }))).container.innerHTML).toBe("");
    getHeadToHead.mockRejectedValue(new Error("quota"));
    expect((await renderBlock(HeadToHeadBlock({ fixture, locale: "ar", labels: h2hLabels }))).container.innerHTML).toBe("");
  });
});
