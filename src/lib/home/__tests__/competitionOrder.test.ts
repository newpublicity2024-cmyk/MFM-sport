import { describe, it, expect } from "vitest";
import {
  buildLeagueOrder,
  buildLogoOverrides,
  competitionLogoUrl,
  pickDefaultCompetition,
  resolveFeaturedCompetition,
  sortByDisplayOrder,
  toCompetitionRef,
} from "@/lib/home/competitionOrder";

const botola = {
  slug: "botola-pro",
  name: "البطولة الاحترافية",
  apiFootballId: 200,
  season: 2026,
  displayOrder: 0,
};
const worldCup = {
  slug: "world-cup",
  name: "كأس العالم",
  apiFootballId: 1,
  season: 2026,
  displayOrder: 90,
  logoUrl: "/images/world-cup-2026.png",
};
const ucl = {
  slug: "champions-league",
  name: "دوري أبطال أوروبا",
  apiFootballId: 2,
  season: 2026,
  displayOrder: 10,
};

describe("sortByDisplayOrder", () => {
  it("orders ascending and does not mutate the input", () => {
    const docs = [worldCup, botola, ucl];
    const sorted = sortByDisplayOrder(docs);
    expect(sorted.map((c) => c.slug)).toEqual(["botola-pro", "champions-league", "world-cup"]);
    expect(docs[0]).toBe(worldCup);
  });

  it("sorts docs with no displayOrder after those that have one", () => {
    const unset = { slug: "ligue-1", displayOrder: null };
    expect(sortByDisplayOrder([unset, worldCup]).map((c) => c.slug)).toEqual([
      "world-cup",
      "ligue-1",
    ]);
  });

  it("breaks ties by slug so the order is stable across renders", () => {
    const a = { slug: "aaa", displayOrder: 5 };
    const z = { slug: "zzz", displayOrder: 5 };
    expect(sortByDisplayOrder([z, a]).map((c) => c.slug)).toEqual(["aaa", "zzz"]);
    expect(sortByDisplayOrder([a, z]).map((c) => c.slug)).toEqual(["aaa", "zzz"]);
  });
});

describe("pickDefaultCompetition", () => {
  it("is the lowest display order, not a hardcoded league", () => {
    expect(pickDefaultCompetition([worldCup, ucl, botola])?.slug).toBe("botola-pro");
  });

  it("follows an edit: re-ranking changes the default with no code change", () => {
    const promoted = { ...ucl, displayOrder: -1 };
    expect(pickDefaultCompetition([worldCup, promoted, botola])?.slug).toBe("champions-league");
  });

  it("returns null when the site has no competitions", () => {
    expect(pickDefaultCompetition([])).toBeNull();
  });
});

describe("toCompetitionRef", () => {
  it("carries the id, season and localized name off a populated relationship", () => {
    expect(toCompetitionRef(botola)).toEqual({
      apiFootballId: 200,
      season: 2026,
      slug: "botola-pro",
      name: "البطولة الاحترافية",
    });
  });

  it("rejects a bare id (relationship not populated — depth too shallow)", () => {
    expect(toCompetitionRef(7)).toBeNull();
    expect(toCompetitionRef(null)).toBeNull();
  });

  it("rejects a doc missing the fields fixtures need", () => {
    expect(toCompetitionRef({ slug: "x", apiFootballId: 200 })).toBeNull();
    expect(toCompetitionRef({ slug: "x", season: 2026 })).toBeNull();
  });
});

describe("resolveFeaturedCompetition", () => {
  it("prefers the explicitly chosen competition", () => {
    expect(resolveFeaturedCompetition(ucl, [botola, worldCup])?.slug).toBe("champions-league");
  });

  it("falls back to the default when nothing is chosen", () => {
    expect(resolveFeaturedCompetition(null, [worldCup, botola])?.slug).toBe("botola-pro");
  });

  it("falls back when the relationship came back unpopulated", () => {
    expect(resolveFeaturedCompetition(42, [worldCup, botola])?.slug).toBe("botola-pro");
  });

  it("returns null rather than inventing a league when there are none", () => {
    expect(resolveFeaturedCompetition(null, [])).toBeNull();
  });
});

describe("competitionLogoUrl", () => {
  it("prefers the CMS logo — the World Cup emblem is now just a logoUrl", () => {
    expect(competitionLogoUrl(1, "/images/world-cup-2026.png")).toBe(
      "/images/world-cup-2026.png",
    );
  });

  it("falls back to API-Football's CDN crest", () => {
    expect(competitionLogoUrl(200, null)).toBe(
      "https://media.api-sports.io/football/leagues/200.png",
    );
    expect(competitionLogoUrl(200, "")).toBe(
      "https://media.api-sports.io/football/leagues/200.png",
    );
  });
});

describe("buildLogoOverrides", () => {
  it("maps league id → CMS logo, and only for docs that set one", () => {
    expect(buildLogoOverrides([botola, worldCup])).toEqual({
      1: "/images/world-cup-2026.png",
    });
  });

  it("is empty when nothing overrides, so upstream crests are used", () => {
    expect(buildLogoOverrides([botola, ucl])).toEqual({});
  });
});

describe("buildLeagueOrder", () => {
  it("maps league id → display order for grouping upstream fixtures", () => {
    expect(buildLeagueOrder([botola, ucl, worldCup])).toEqual({ 200: 0, 2: 10, 1: 90 });
  });

  it("defaults docs with no display order rather than dropping them", () => {
    expect(buildLeagueOrder([{ apiFootballId: 61, displayOrder: null }])).toEqual({ 61: 100 });
  });
});
