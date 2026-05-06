import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useFixture } from "@/hooks/useFixture";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("useFixture", () => {
  it("fetches once on mount and returns the fixture", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixture: { fixture: { id: 7 } } }));
    const { result } = renderHook(() =>
      useFixture(7, { initial: null, intervalMs: 30000, enabled: true }),
    );
    await waitFor(() => expect(result.current.fixture).toEqual({ fixture: { id: 7 } }));
    expect(fetchMock).toHaveBeenCalledWith("/api/fixtures/7", expect.any(Object));
  });

  it("uses initial data without an immediate fetch when provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixture: { fixture: { id: 7 } } }));
    const initial = { fixture: { id: 7, score: "0-0" } } as never;
    const { result } = renderHook(() =>
      useFixture(7, { initial, intervalMs: 30000, enabled: true }),
    );
    expect(result.current.fixture).toBe(initial);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("polls on the interval", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixture: { fixture: { id: 7 } } }));
    renderHook(() => useFixture(7, { initial: null, intervalMs: 30000, enabled: true }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("does not fetch when enabled is false", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixture: { fixture: { id: 7 } } }));
    renderHook(() => useFixture(7, { initial: null, intervalMs: 30000, enabled: false }));
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exposes fetch errors via error state", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const { result } = renderHook(() =>
      useFixture(7, { initial: null, intervalMs: 30000, enabled: true }),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
