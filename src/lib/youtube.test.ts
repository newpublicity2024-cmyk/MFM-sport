import { describe, it, expect } from "vitest";
import { parseIsoDuration, PLAYLISTS } from "./youtube";

describe("parseIsoDuration", () => {
  it("formats minutes and seconds zero-padded", () => {
    expect(parseIsoDuration("PT8M12S")).toBe("08:12");
  });
  it("keeps two-digit minutes", () => {
    expect(parseIsoDuration("PT12M1S")).toBe("12:01");
  });
  it("handles seconds-only", () => {
    expect(parseIsoDuration("PT45S")).toBe("00:45");
  });
  it("handles minutes-only", () => {
    expect(parseIsoDuration("PT12M")).toBe("12:00");
  });
  it("includes hours when present", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe("1:02:03");
  });
  it("handles hours with no minutes/seconds", () => {
    expect(parseIsoDuration("PT1H")).toBe("1:00:00");
  });
  it("returns 00:00 for empty/zero", () => {
    expect(parseIsoDuration("PT0S")).toBe("00:00");
    expect(parseIsoDuration("")).toBe("00:00");
  });
});

describe("PLAYLISTS", () => {
  it("declares the two configured playlists in order", () => {
    expect(PLAYLISTS.map((p) => p.key)).toEqual([
      "the-third-half",
      "from-the-stadiums",
    ]);
    expect(PLAYLISTS[0].playlistId).toBe("PL0toBD2vH6zPrTFvXcVQqYLpwifwiWEGi");
    expect(PLAYLISTS[1].playlistId).toBe("PL0toBD2vH6zMqBunGKI5DRd1jz1CH7-xa");
  });
});
