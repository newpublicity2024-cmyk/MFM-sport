"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ApiFixture } from "@/lib/api-football/types";
import { getMatchStatus } from "@/lib/api-football/types";

export type UseFixtureOptions = {
  initial: ApiFixture | null;
  intervalMs: number;
  enabled: boolean;
  // Epoch ms of kickoff. When set and the match is still scheduled, polling is
  // deferred until shortly before kickoff instead of every intervalMs.
  kickoffTs?: number;
};

export type UseFixtureResult = {
  fixture: ApiFixture | null;
  isLoading: boolean;
  error: Error | null;
};

// Start polling this long before a scheduled kickoff.
const KICKOFF_LEAD_MS = 5 * 60_000;

// Short statuses that won't change via polling — stop once any is reached.
// (Finished outcomes plus postponed/cancelled/abandoned/walkover/awarded.)
const DONE_STATUSES = new Set(["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"]);

export function useFixture(id: number, options: UseFixtureOptions): UseFixtureResult {
  const { initial, intervalMs, enabled, kickoffTs } = options;
  const [fixture, setFixture] = useState<ApiFixture | null>(initial);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const fixtureRef = useRef<ApiFixture | null>(initial);

  const fetchOnce = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (isMountedRef.current) setIsLoading(true);
    try {
      const res = await fetch(`/api/fixtures/${id}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { fixture: ApiFixture };
      if (!isMountedRef.current) return;
      fixtureRef.current = json.fixture;
      setFixture(json.fixture);
      setError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (!isMountedRef.current) return;
      setError(e as Error);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    // null => stop polling. An unknown/missing status keeps polling (the match
    // may just not be loaded yet); only an explicit terminal status stops it.
    const nextDelay = (): number | null => {
      const short = fixtureRef.current?.fixture?.status?.short;
      if (short && DONE_STATUSES.has(short)) return null;
      if (short && getMatchStatus(short) === "scheduled" && typeof kickoffTs === "number") {
        const until = kickoffTs - KICKOFF_LEAD_MS - Date.now();
        if (until > intervalMs) return until; // sleep until near kickoff
      }
      return intervalMs;
    };

    const schedule = () => {
      const d = nextDelay();
      if (d === null) return;
      timer = setTimeout(tick, d);
    };

    const tick = async () => {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        await fetchOnce();
      }
      if (!isMountedRef.current) return;
      schedule();
    };

    // Fetch immediately only when we have nothing to show yet. The recurring
    // timer is established synchronously (status drives its cadence, and a
    // finished match schedules nothing).
    if (fixtureRef.current === null) void fetchOnce();
    schedule();

    return () => {
      isMountedRef.current = false;
      if (timer) clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, kickoffTs, fetchOnce]);

  return { fixture, isLoading, error };
}
