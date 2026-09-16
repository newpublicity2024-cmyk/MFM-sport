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
import { NATIONAL_TEAMS_AR } from "@/lib/api-football/dictionaries/national-teams.ar";

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
  const ARABIC = /[؀-ۿ]/;
  const LATIN = /[a-z]/i;

  it("returns Latin verbatim for non-ar locales", () => {
    expect(localizeLeague(200, "Botola Pro", "fr")).toBe("Botola Pro");
    expect(localizeTeam(529, "Barcelona", "en")).toBe("Barcelona");
    expect(localizePerson(123, "John Doe", "en")).toBe("John Doe");
  });
  it("transliterates to Arabic when an ar mapping is missing", () => {
    for (const out of [
      localizeTeam(-999, "Unknown FC", "ar"),
      localizePerson(-999, "John Doe", "ar"),
      localizePerson(null, "John Doe", "ar"), // assist with no id
    ]) {
      expect(out).toMatch(ARABIC);
      expect(out).not.toMatch(LATIN);
    }
  });
});

describe("localizeTeam — Botola Pro 1 (2026/27)", () => {
  // Every club in the home league must resolve to its curated Arabic name, not
  // the transliteration fallback — which is what shipped for six of them
  // ("كاوكاب ماراكيتش", "كودم ميكنيس", "أوتس رابات", …) before the entries
  // existed. Spellings follow Kooora's standings table; ids are api-football's,
  // read from the crest URLs on /ar/competition/botola-pro-1.
  it.each([
    [962, "Renaissance Berkane", "نهضة بركان"],
    [964, "Difaa El Jadida", "الدفاع الحسني الجديدي"],
    [965, "Moghreb Tetouan", "المغرب التطواني"],
    [968, "Wydad AC", "الوداد الرياضي"],
    [969, "FAR Rabat", "الجيش الملكي"],
    [971, "Kawkab Marrakech", "الكوكب الرياضي المراكشي"],
    [973, "Hassania Agadir", "حسنية أغادير"],
    [974, "Ittihad Tanger", "إتحاد طنجة"],
    [976, "Raja Casablanca", "الرجاء البيضاوي"],
    [977, "FUS Rabat", "الفتح الرباطي"],
    [3449, "KR Khemis Zemamra", "نهضة الزمامرة"],
    [3453, "Maghreb Fes", "المغرب الفاسي"],
    [3458, "Wydad Temara", "وداد تمارة"],
    [14806, "UTS Rabat", "إتحاد تواركة"],
    [18753, "US Amal Tiznit", "أمل تيزنيت"],
    [22218, "CODM Meknes", "النادي المكناسي"],
  ])("id %i (%s) → %s", (id, latin, expected) =>
    expect(localizeTeam(id, latin, "ar")).toBe(expected));
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

describe("national-team localization", () => {
  const ARABIC = /[؀-ۿ]/;
  const LATIN = /[a-z]/i;

  it("has broad national-team coverage", () => {
    expect(Object.keys(NATIONAL_TEAMS_AR).length).toBeGreaterThan(100);
  });
  it("uses the proper Arabic country name over club dict / transliteration (ar)", () => {
    const [idStr, ar] = Object.entries(NATIONAL_TEAMS_AR)[0];
    const out = localizeTeam(Number(idStr), "Some Latin Name", "ar");
    expect(out).toBe(ar);
    expect(out).toMatch(ARABIC);
    expect(out).not.toMatch(LATIN);
  });
  it("returns Latin for non-ar even for a national-team id", () => {
    const [idStr] = Object.entries(NATIONAL_TEAMS_AR)[0];
    expect(localizeTeam(Number(idStr), "South Africa", "en")).toBe("South Africa");
  });
});

describe("league dictionary coverage", () => {
  it("covers every homepage league id", () => {
    for (const l of LEAGUES) {
      expect(LEAGUES_AR[l.apiFootballId], `missing ar for league ${l.apiFootballId}`).toBeTruthy();
    }
  });
});
