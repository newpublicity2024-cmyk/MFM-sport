import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi, ApiFootballUnavailableError } from "../client";

/**
 * The distinction under test: "upstream is unavailable" must not be reportable
 * as "there is no such thing".
 *
 * A match page turns an empty result into notFound(), so conflating the two made
 * a daily-quota outage serve 404s for fixtures that exist — which asks Google to
 * drop indexed pages. 5xx asks it to come back later.
 */
const ORIGINAL_KEY = process.env.API_FOOTBALL_KEY;

beforeEach(() => {
  process.env.API_FOOTBALL_KEY = "test-key";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  process.env.API_FOOTBALL_KEY = ORIGINAL_KEY;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockResponse(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? "OK" : "Too Many Requests",
      json: async () => body,
    }),
  );
}

// The exact shape API-Football returns when the daily plan is exhausted:
// HTTP 200, empty response, and the reason tucked into `errors`. This is why it
// read as a successful empty result.
const QUOTA_EXHAUSTED = {
  get: "fixtures",
  parameters: {},
  errors: { requests: "You have reached the request limit for the day" },
  results: 0,
  paging: { current: 1, total: 1 },
  response: [],
};

const GENUINELY_EMPTY = {
  get: "fixtures",
  parameters: {},
  errors: [],
  results: 0,
  paging: { current: 1, total: 1 },
  response: [],
};

describe("fetchApi upstream failure handling", () => {
  it("throws on quota exhaustion when throwOnFailure is set", async () => {
    mockResponse(QUOTA_EXHAUSTED);
    await expect(
      fetchApi("/fixtures", { id: 1 }, { throwOnFailure: true }),
    ).rejects.toBeInstanceOf(ApiFootballUnavailableError);
  });

  it("still returns [] for a genuinely empty result, even with throwOnFailure", async () => {
    // The whole point: an id that truly has no fixture must remain a 404.
    mockResponse(GENUINELY_EMPTY);
    await expect(
      fetchApi("/fixtures", { id: 1 }, { throwOnFailure: true }),
    ).resolves.toEqual([]);
  });

  it("throws on an HTTP error when throwOnFailure is set", async () => {
    mockResponse({}, false, 429);
    await expect(
      fetchApi("/fixtures", { id: 1 }, { throwOnFailure: true }),
    ).rejects.toBeInstanceOf(ApiFootballUnavailableError);
  });

  it("throws when no API key is configured", async () => {
    delete process.env.API_FOOTBALL_KEY;
    await expect(
      fetchApi("/fixtures", { id: 1 }, { throwOnFailure: true }),
    ).rejects.toBeInstanceOf(ApiFootballUnavailableError);
  });

  it("degrades to [] by default, so list widgets stay graceful", async () => {
    // Homepage carousels prefer an empty rail to a broken page — the default
    // must not change.
    mockResponse(QUOTA_EXHAUSTED);
    await expect(fetchApi("/fixtures", { date: "2026-07-28" })).resolves.toEqual([]);

    mockResponse({}, false, 500);
    await expect(fetchApi("/fixtures", { date: "2026-07-28" })).resolves.toEqual([]);
  });
});
