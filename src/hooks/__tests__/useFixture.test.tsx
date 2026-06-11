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

  it("skips fetch when document is hidden", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixture: { fixture: { id: 7 } } }));
    const original = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    try {
      renderHook(() => useFixture(7, { initial: { fixture: { id: 7 } } as never, intervalMs: 30000, enabled: true }));
      await act(async () => {
        vi.advanceTimersByTime(60000);
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      // Delete the instance override so "hidden" doesn't leak into later tests.
      Reflect.deleteProperty(document, "visibilityState");
      if (original) Object.defineProperty(Document.prototype, "visibilityState", original);
    }
  });

  it("stops polling once the match is finished", async () => {
    // Live initial → polls once at intervalMs; the response is full-time, so it
    // must not poll again.
    fetchMock.mockResolvedValue(
      jsonResponse({ fixture: { fixture: { id: 7, status: { short: "FT" } } } }),
    );
    renderHook(() =>
      useFixture(7, {
        initial: { fixture: { id: 7, status: { short: "1H" } } } as never,
        intervalMs: 30000,
        enabled: true,
      }),
    );
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      vi.advanceTimersByTime(120000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not poll a postponed/cancelled match", async () => {
    renderHook(() =>
      useFixture(7, {
        initial: { fixture: { id: 7, status: { short: "PST" } } } as never,
        intervalMs: 30000,
        enabled: true,
      }),
    );
    await act(async () => {
      vi.advanceTimersByTime(120000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not poll a scheduled match far before kickoff", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ fixture: { fixture: { id: 7, status: { short: "NS" } } } }),
    );
    const kickoffTs = Date.now() + 60 * 60_000; // 1 hour away
    renderHook(() =>
      useFixture(7, {
        initial: { fixture: { id: 7, status: { short: "NS" } } } as never,
        intervalMs: 30000,
        enabled: true,
        kickoffTs,
      }),
    );
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(120000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
