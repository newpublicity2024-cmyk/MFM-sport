import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "../client";

const originalFetch = global.fetch;
const originalKey = process.env.API_FOOTBALL_KEY;

describe("fetchApi", () => {
  beforeEach(() => {
    process.env.API_FOOTBALL_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.API_FOOTBALL_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("returns the response array on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [], response: [{ id: 1 }, { id: 2 }] }),
    } as unknown as Response);

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("returns [] when API errors object is non-empty", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: { plan: "Free plans do not have access to this season" },
        response: [],
      }),
    } as unknown as Response);

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
  });

  it("returns [] when response field is null", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [], response: null }),
    } as unknown as Response);

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
  });

  it("returns [] when response field is undefined", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [] }),
    } as unknown as Response);

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
  });

  it("returns [] on non-2xx HTTP status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      json: async () => ({}),
    } as unknown as Response);

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
  });

  it("returns [] when no API_FOOTBALL_KEY is configured", async () => {
    delete process.env.API_FOOTBALL_KEY;
    global.fetch = vi.fn(); // should never be called

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
