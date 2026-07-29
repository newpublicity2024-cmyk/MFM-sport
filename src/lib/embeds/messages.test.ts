import { describe, it, expect } from "vitest";
import type { EmbedFailure } from "./parseEmbed";
import { EMBED_FAILURE_MESSAGES, embedFailureMessageAr } from "./messages";

// The four EmbedFailure reasons, spelled out literally rather than derived from
// EMBED_FAILURE_MESSAGES itself — Object.keys(EMBED_FAILURE_MESSAGES) would trivially
// "pass" even if the map were missing a key, since it only iterates what's already
// there. Listing them by hand is what actually catches a reason with no message.
const ALL_REASONS: readonly EmbedFailure[] = ["empty", "unsupported", "short-link", "multiple"];

describe("EMBED_FAILURE_MESSAGES — one entry per EmbedFailure reason", () => {
  it.each(ALL_REASONS)("has a non-empty Arabic message for %s", (reason) => {
    const message = EMBED_FAILURE_MESSAGES[reason];
    expect(message).toBeDefined();
    expect(message.ar.trim().length).toBeGreaterThan(0);
  });

  it.each(ALL_REASONS)("has non-empty en and fr alongside the Arabic message for %s", (reason) => {
    const message = EMBED_FAILURE_MESSAGES[reason];
    expect(message.en.trim().length).toBeGreaterThan(0);
    expect(message.fr.trim().length).toBeGreaterThan(0);
  });

  it("has exactly the four known reasons — no more, no fewer", () => {
    expect(Object.keys(EMBED_FAILURE_MESSAGES).sort()).toEqual([...ALL_REASONS].sort());
  });
});

describe("embedFailureMessageAr — content matches what each reason must convey", () => {
  it("empty: conveys that nothing was entered", () => {
    expect(embedFailureMessageAr("empty")).toBe(EMBED_FAILURE_MESSAGES.empty.ar);
  });

  it("unsupported: names all four supported platforms in Arabic", () => {
    const message = embedFailureMessageAr("unsupported");
    expect(message).toContain("فيسبوك");
    expect(message).toContain("إكس");
    expect(message).toContain("إنستغرام");
    expect(message).toContain("يوتيوب");
  });

  it("short-link: names fb.watch and points at the address bar", () => {
    const message = embedFailureMessageAr("short-link");
    expect(message).toContain("fb.watch");
  });

  it("multiple: says a single link/post is expected", () => {
    const message = embedFailureMessageAr("multiple");
    expect(message).toContain("واحد");
  });

  it("returns the same string as EMBED_FAILURE_MESSAGES[reason].ar for every reason", () => {
    for (const reason of ALL_REASONS) {
      expect(embedFailureMessageAr(reason)).toBe(EMBED_FAILURE_MESSAGES[reason].ar);
    }
  });
});
