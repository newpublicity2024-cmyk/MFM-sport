import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFootballUnavailableError, UPSTREAM_TIMEOUT_MS, fetchApi } from "../client";

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

  // A stalled upstream used to hold the page open for as long as Vercel allowed
  // (35–95 s measured on production). The request now carries a timeout signal,
  // and a timeout is reported exactly like an HTTP error.
  it("passes an abort signal bounded by the default timeout", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [], response: [] }),
    } as unknown as Response);

    await fetchApi("/foo", {});
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(UPSTREAM_TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });

  it("returns [] when the request times out", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    const result = await fetchApi<{ id: number }>("/foo", {});
    expect(result).toEqual([]);
  });

  it("throws ApiFootballUnavailableError on timeout when throwOnFailure is set", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    await expect(fetchApi("/foo", {}, { throwOnFailure: true })).rejects.toBeInstanceOf(
      ApiFootballUnavailableError,
    );
  });

  it("honours a per-call timeoutMs override", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [], response: [] }),
    } as unknown as Response);

    await fetchApi("/foo", {}, { timeoutMs: 1234 });
    expect(spy).toHaveBeenCalledWith(1234);
  });
});
