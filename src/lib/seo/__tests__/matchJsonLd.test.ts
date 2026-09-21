import { describe, it, expect } from "vitest";
import { matchJsonLd } from "../matchJsonLd";
import type { ApiFixture } from "@/lib/api-football/types";
import { localizeTeam } from "@/lib/api-football/localize";

function fixture(over: Partial<ApiFixture["fixture"]> = {}): ApiFixture {
  return {
    fixture: {
      id: 1550109,
      date: "2026-09-07T16:30:00+00:00",
      timestamp: 0,
      venue: { id: 1, name: "Unipol Domus", city: "Cagliari" },
      status: { long: "Match Finished", short: "FT", elapsed: 90 },
      referee: "M. Guida",
      ...over,
    },
    league: { id: 135, name: "Serie A", country: "Italy", logo: "l.png", flag: null, season: 2026, round: "Regular Season - 3" },
    teams: {
      home: { id: 490, name: "Cagliari", logo: "h.png", winner: false },
      away: { id: 867, name: "Lecce", logo: "a.png", winner: true },
    },
    goals: { home: 1, away: 2 },
    score: {
      halftime: { home: 0, away: 1 }, fulltime: { home: 1, away: 2 },
      extratime: { home: null, away: null }, penalty: { home: null, away: null },
    },
  };
}
const labels = { home: "الرئيسية", matches: "المباريات" };
// The dictionary owns the spelling; the test only asserts it is used, in Arabic.
const HOME_AR = localizeTeam(490, "Cagliari", "ar");
const AWAY_AR = localizeTeam(867, "Lecce", "ar");

function graph(fx: ApiFixture) {
  return matchJsonLd(fx, "ar", labels)["@graph"] as Record<string, unknown>[];
}

describe("matchJsonLd", () => {
  it("emits a SportsEvent and a BreadcrumbList", () => {
    const g = graph(fixture());
    expect(g.map((n) => n["@type"])).toEqual(["SportsEvent", "BreadcrumbList"]);
  });

  it("names the event in Arabic with the kick-off instant and the venue", () => {
    const [event] = graph(fixture());
    expect(event.name).toBe(`${HOME_AR} ضد ${AWAY_AR}`);
    expect(event.name).not.toMatch(/[A-Za-z]/);
    expect(event.name).not.toContain("Cagliari");
    expect(event.startDate).toBe("2026-09-07T16:30:00+00:00");
    expect(event.location).toEqual({
      "@type": "Place",
      name: "Unipol Domus",
      address: { "@type": "PostalAddress", addressLocality: "Cagliari" },
    });
    expect(event.url).toBe("https://www.mfmsport.ma/ar/matches/1550109");
  });

  it("maps the API status to the schema.org event status", () => {
    expect(graph(fixture())[0].eventStatus).toBe("https://schema.org/EventScheduled");
    expect(graph(fixture({ status: { long: "", short: "PST", elapsed: null } }))[0].eventStatus)
      .toBe("https://schema.org/EventPostponed");
    expect(graph(fixture({ status: { long: "", short: "CANC", elapsed: null } }))[0].eventStatus)
      .toBe("https://schema.org/EventCancelled");
  });

  it("omits the location entirely when upstream has no venue, and never serialises undefined", () => {
    const [event] = graph(fixture({ venue: null }));
    expect("location" in event).toBe(false);
    const json = JSON.stringify(matchJsonLd(fixture({ venue: null }), "ar", labels));
    expect(json).not.toMatch(/undefined|null/);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("omits the address when the venue has no city", () => {
    const [event] = graph(fixture({ venue: { id: 1, name: "Stade", city: null } }));
    expect(event.location).toEqual({ "@type": "Place", name: "Stade" });
  });

  it("builds a three-step breadcrumb ending on the canonical match URL", () => {
    const [, crumbs] = graph(fixture());
    const items = crumbs.itemListElement as { position: number; item: string; name: string }[];
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(items[0].item).toBe("https://www.mfmsport.ma/ar");
    expect(items[1].item).toBe("https://www.mfmsport.ma/ar/matches");
    expect(items[2].item).toBe("https://www.mfmsport.ma/ar/matches/1550109");
    expect(items[2].name).toBe(`${HOME_AR} ضد ${AWAY_AR}`);
  });
});
