import { describe, it, expect } from "vitest";
import {
  pickLocale,
  localizeLeague,
  localizeTeam,
  localizePerson,
} from "@/lib/api-football/localize";

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
