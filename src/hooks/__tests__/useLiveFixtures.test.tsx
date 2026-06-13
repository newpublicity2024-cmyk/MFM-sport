import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useLiveFixtures } from "@/hooks/useLiveFixtures";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("useLiveFixtures", () => {
  it("returns initial array without fetching when provided", () => {
    const initial = [{ fixture: { id: 1 } }] as never;
    const { result } = renderHook(() =>
      useLiveFixtures({ initial, intervalMs: 60000, enabled: true }),
    );
    expect(result.current.fixtures).toBe(initial);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("polls /api/fixtures/live every intervalMs", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixtures: [] }));
    renderHook(() => useLiveFixtures({ initial: [], intervalMs: 60000, enabled: true }));
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/fixtures/live", expect.any(Object));
  });

  it("updates fixtures from server response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixtures: [{ fixture: { id: 9 } }] }));
    const { result } = renderHook(() =>
      useLiveFixtures({ initial: [], intervalMs: 60000, enabled: true }),
    );
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    await waitFor(() => expect(result.current.fixtures.length).toBe(1));
  });

  it("does not poll when disabled", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixtures: [] }));
    renderHook(() => useLiveFixtures({ initial: [], intervalMs: 60000, enabled: false }));
    await act(async () => {
      vi.advanceTimersByTime(120000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips fetch when document is hidden", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixtures: [] }));
    const original = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    try {
      renderHook(() =>
        useLiveFixtures({
          initial: [{ fixture: { id: 1 } }] as never,
          intervalMs: 60000,
          enabled: true,
        }),
      );
      await act(async () => {
        vi.advanceTimersByTime(120000);
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      // The override above is an OWN property on the document instance; deleting
      // it lets visibilityState fall back to the prototype (else "hidden" leaks
      // into later tests in this file).
      Reflect.deleteProperty(document, "visibilityState");
      if (original) Object.defineProperty(Document.prototype, "visibilityState", original);
    }
  });

  it("backs off to idleIntervalMs after a response with no live fixtures", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixtures: [] }));
    renderHook(() =>
      useLiveFixtures({
        initial: [],
        intervalMs: 60000,
        enabled: true,
        idleIntervalMs: 300000,
      }),
    );
    // First poll fires at intervalMs and returns nothing live.
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Another intervalMs passes — but it should NOT poll again yet (now idle).
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Only after idleIntervalMs elapses does it poll again.
    await act(async () => {
      vi.advanceTimersByTime(240000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("keeps the fast cadence while live fixtures are present", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ fixtures: [{ fixture: { id: 1 } }] }));
    renderHook(() =>
      useLiveFixtures({ initial: [], intervalMs: 60000, enabled: true }),
    );
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Response had a live fixture → next poll stays at intervalMs.
    await act(async () => {
      vi.advanceTimersByTime(60000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
