import { describe, it, expect } from "vitest";
import {
  buildPinnedLeagueOrder,
  resolveHeroCompetitions,
} from "@/lib/home/competitionOrder";

const docs = [
  { slug: "botola-pro-1", apiFootballId: 200, season: 2026, displayOrder: 0 },
  { slug: "premier-league", apiFootballId: 39, season: 2026, displayOrder: 100 },
  { slug: "la-liga", apiFootballId: 140, season: 2026, displayOrder: 100 },
  { slug: "serie-a", apiFootballId: 135, season: 2026, displayOrder: 100 },
  { slug: "bundesliga", apiFootballId: 78, season: 2026, displayOrder: 100 },
];
const row = (slug: string) => ({ competition: docs.find((d) => d.slug === slug) });

describe("resolveHeroCompetitions", () => {
  it("returns every chosen league in the admin's order", () => {
    const out = resolveHeroCompetitions(
      [row("premier-league"), row("la-liga"), row("serie-a"), row("bundesliga")],
      docs,
    );
    expect(out.map((c) => c.apiFootballId)).toEqual([39, 140, 135, 78]);
  });

  it("skips rows whose competition did not populate and de-duplicates", () => {
    const out = resolveHeroCompetitions(
      [{ competition: 7 }, row("serie-a"), row("serie-a"), { competition: null }],
      docs,
    );
    expect(out.map((c) => c.apiFootballId)).toEqual([135]);
  });

  it("falls back to the default (lowest displayOrder) competition when nothing is chosen", () => {
    expect(resolveHeroCompetitions([], docs).map((c) => c.slug)).toEqual(["botola-pro-1"]);
    expect(resolveHeroCompetitions(undefined, docs).map((c) => c.slug)).toEqual(["botola-pro-1"]);
  });

  it("returns [] when the site has no competitions at all", () => {
    expect(resolveHeroCompetitions([], [])).toEqual([]);
  });
});

describe("buildPinnedLeagueOrder", () => {
  it("ranks the chosen leagues first, in admin order, ahead of every CMS displayOrder", () => {
    const order = buildPinnedLeagueOrder(
      [{ apiFootballId: 39 }, { apiFootballId: 140 }],
      docs,
    );
    expect(order[39]).toBe(0);
    expect(order[140]).toBe(1);
    // Botola has displayOrder 0 in the CMS but was not chosen: it sorts after both.
    expect(order[200]).toBeGreaterThan(order[140]);
    expect(order[135]).toBeGreaterThan(order[200]);
  });
});
