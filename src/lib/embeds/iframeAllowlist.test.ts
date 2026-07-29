import { describe, it, expect } from "vitest";
import { IFRAME_HOSTNAME_ALLOWLIST, isAllowedIframeHostname, isAllowedIframeSrc } from "./iframeAllowlist";

describe("isAllowedIframeSrc — accepts a real embed URL from each allowed provider", () => {
  it("accepts a Datawrapper chart embed", () => {
    expect(isAllowedIframeSrc("https://datawrapper.dwcdn.net/abc12/1/")).toBe(true);
  });

  it("accepts a Google Maps embed", () => {
    expect(isAllowedIframeSrc("https://www.google.com/maps/embed?pb=!1m18")).toBe(true);
  });

  it("accepts a SoundCloud player embed — load-bearing, MFM is a radio brand", () => {
    expect(
      isAllowedIframeSrc("https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1"),
    ).toBe(true);
  });

  it("accepts a Spotify embed", () => {
    expect(isAllowedIframeSrc("https://open.spotify.com/embed/track/abc123")).toBe(true);
  });
});

describe("isAllowedIframeSrc — rejects everything outside the allowlist (exact match only)", () => {
  it("rejects notsoundcloud.com — must not pass an endsWith-style check", () => {
    expect(isAllowedIframeSrc("https://notsoundcloud.com/player")).toBe(false);
  });

  it("rejects a bare evil.com", () => {
    expect(isAllowedIframeSrc("https://evil.com/")).toBe(false);
  });

  it("rejects a non-URL string", () => {
    expect(isAllowedIframeSrc("not a url")).toBe(false);
  });

  it("rejects empty and whitespace-only input", () => {
    expect(isAllowedIframeSrc("")).toBe(false);
    expect(isAllowedIframeSrc("   ")).toBe(false);
  });

  it("rejects non-string input without throwing", () => {
    expect(() => isAllowedIframeSrc(undefined)).not.toThrow();
    expect(isAllowedIframeSrc(undefined)).toBe(false);
    expect(isAllowedIframeSrc(null)).toBe(false);
    expect(isAllowedIframeSrc(123)).toBe(false);
  });

  it("rejects a subdomain trick — real.host.example.com is not an exact match for the allowed host", () => {
    expect(isAllowedIframeSrc("https://open.spotify.com.evil.com/embed/track/1")).toBe(false);
  });

  it("rejects a query-string trick — the allowed hostname appearing only in the query is not the actual host", () => {
    expect(isAllowedIframeSrc("https://evil.com/?x=open.spotify.com")).toBe(false);
  });

  it("rejects a bare hostname with no scheme", () => {
    expect(isAllowedIframeSrc("open.spotify.com/embed/track/1")).toBe(false);
  });
});

describe("isAllowedIframeSrc — path scoping (fix round 1, Finding 1)", () => {
  // www.google.com is Google's general web frontend, not a dedicated embed subdomain
  // like the other three hosts — so without a path constraint, any Google page would
  // validate as a "Google Maps embed". These two are the exact bypasses the reviewer
  // verified live against the pre-fix code (both returned true).
  it("rejects a Google search results page — hostname alone is not enough", () => {
    expect(isAllowedIframeSrc("https://www.google.com/search?q=test")).toBe(false);
  });

  it("rejects the bare Google homepage", () => {
    expect(isAllowedIframeSrc("https://www.google.com/")).toBe(false);
  });

  it("accepts a real Google Maps embed", () => {
    expect(isAllowedIframeSrc("https://www.google.com/maps/embed?pb=...")).toBe(true);
  });

  it("rejects /maps/embedxyz — segment boundary, not a bare startsWith", () => {
    expect(isAllowedIframeSrc("https://www.google.com/maps/embedxyz")).toBe(false);
  });

  it("accepts a SoundCloud player path", () => {
    expect(isAllowedIframeSrc("https://w.soundcloud.com/player/?url=...")).toBe(true);
  });

  it("rejects a non-player SoundCloud path", () => {
    expect(isAllowedIframeSrc("https://w.soundcloud.com/anything-else")).toBe(false);
  });

  it("accepts a Spotify track embed", () => {
    expect(isAllowedIframeSrc("https://open.spotify.com/embed/track/abc")).toBe(true);
  });

  it("rejects a non-embed Spotify path", () => {
    expect(isAllowedIframeSrc("https://open.spotify.com/track/abc")).toBe(false);
  });

  it("accepts a Datawrapper chart at any path — no prefix constraint for this host", () => {
    expect(isAllowedIframeSrc("https://datawrapper.dwcdn.net/AbCdE/1/")).toBe(true);
  });
});

describe("isAllowedIframeHostname — exact equality, case-insensitive", () => {
  it("matches every host in the allowlist", () => {
    for (const host of IFRAME_HOSTNAME_ALLOWLIST) {
      expect(isAllowedIframeHostname(host)).toBe(true);
    }
  });

  it("is case-insensitive (URL hostnames are ASCII-lowercased by the URL parser, and this must agree)", () => {
    expect(isAllowedIframeHostname("OPEN.SPOTIFY.COM")).toBe(true);
    expect(isAllowedIframeHostname("W.SOUNDCLOUD.COM")).toBe(true);
  });

  it("rejects a host that merely contains an allowed host as a substring", () => {
    expect(isAllowedIframeHostname("xw.soundcloud.com")).toBe(false);
    expect(isAllowedIframeHostname("w.soundcloud.com.evil.com")).toBe(false);
  });
});
