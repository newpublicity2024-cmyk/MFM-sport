import { describe, it, expect } from "vitest";
import { parseIsoDuration, FEEDS, YOUTUBE_CHANNEL_ID, uploadsPlaylistId } from "./youtube";

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

describe("uploadsPlaylistId", () => {
  it("derives a channel's uploads playlist by swapping the UC prefix for UU", () => {
    expect(uploadsPlaylistId("UCnDy06vggD-48O8ePrXMhAw")).toBe("UUnDy06vggD-48O8ePrXMhAw");
  });
  it("rejects anything that is not a channel id (a playlist id, a handle)", () => {
    expect(() => uploadsPlaylistId("PL0toBD2vH6zPrTFvXcVQqYLpwifwiWEGi")).toThrow();
    expect(() => uploadsPlaylistId("@mfmsport1430")).toThrow();
  });
});

describe("FEEDS", () => {
  it("declares exactly one feed: the channel's uploads, not a hand-picked playlist", () => {
    expect(FEEDS.map((f) => f.key)).toEqual(["channel-uploads"]);
    expect(FEEDS[0].playlistId).toBe(uploadsPlaylistId(YOUTUBE_CHANNEL_ID));
    expect(FEEDS[0].playlistId.startsWith("UU")).toBe(true);
  });
});
