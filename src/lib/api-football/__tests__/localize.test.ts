import { describe, it, expect } from "vitest";
import {
  pickLocale,
  localizeLeague,
  localizeTeam,
  localizePerson,
  localizeRound,
  localizeGroup,
} from "@/lib/api-football/localize";
import { LEAGUES } from "@/lib/home/leagues";
import { LEAGUES_AR } from "@/lib/api-football/dictionaries/leagues.ar";

describe("pickLocale", () => {
  const name = { en: "Alpha", ar: "ألفا", fr: "Bravo" };
  it("returns ar for ar", () => expect(pickLocale(name, "ar")).toBe("ألفا"));
  it("returns fr for fr", () => expect(pickLocale(name, "fr")).toBe("Bravo"));
  it("returns en for en/unknown", () => {
    expect(pickLocale(name, "en")).toBe("Alpha");
    expect(pickLocale(name, "de")).toBe("Alpha");
  });
});

describe("localizeLeague / localizeTeam / localizePerson", () => {
  it("returns Latin verbatim for non-ar locales", () => {
    expect(localizeLeague(200, "Botola Pro", "fr")).toBe("Botola Pro");
    expect(localizeTeam(529, "Barcelona", "en")).toBe("Barcelona");
  });
  it("falls back to Latin when ar mapping is missing", () => {
    expect(localizeTeam(-999, "Unknown FC", "ar")).toBe("Unknown FC");
    expect(localizePerson(-999, "John Doe", "ar")).toBe("John Doe");
  });
  it("falls back to Latin for a null/empty id (assist with no id)", () => {
    expect(localizePerson(null, "John Doe", "ar")).toBe("John Doe");
  });
});

describe("localizeRound", () => {
  it("passes through for non-ar", () =>
    expect(localizeRound("Round of 16", "en")).toBe("Round of 16"));
  it.each([
    ["Regular Season - 12", "الأسبوع 12"],
    ["Round of 16", "دور الـ16"],
    ["Quarter-finals", "ربع النهائي"],
    ["Semi-finals", "نصف النهائي"],
    ["Final", "النهائي"],
    ["Matchday 5", "الجولة 5"],
    ["Group Stage", "دور المجموعات"],
  ])("translates %s", (input, expected) =>
    expect(localizeRound(input, "ar")).toBe(expected));
  it("falls through to Latin on no match", () =>
    expect(localizeRound("Some Weird Round", "ar")).toBe("Some Weird Round"));
});

describe("localizeGroup", () => {
  it("translates Group A", () => expect(localizeGroup("Group A", "ar")).toBe("المجموعة أ"));
  it("passes through unknown", () => expect(localizeGroup("Group Z9", "ar")).toBe("Group Z9"));
});

describe("league dictionary coverage", () => {
  it("covers every homepage league id", () => {
    for (const l of LEAGUES) {
      expect(LEAGUES_AR[l.apiFootballId], `missing ar for league ${l.apiFootballId}`).toBeTruthy();
    }
  });
});
