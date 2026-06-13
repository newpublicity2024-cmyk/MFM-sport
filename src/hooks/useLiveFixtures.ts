"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ApiFixture } from "@/lib/api-football/types";

export type UseLiveFixturesOptions = {
  initial: ApiFixture[];
  intervalMs: number;
  enabled: boolean;
  // Slow cadence used when nothing is live (to detect kickoff). Defaults to 5min.
  idleIntervalMs?: number;
};

export type UseLiveFixturesResult = {
  fixtures: ApiFixture[];
  isLoading: boolean;
  error: Error | null;
};

const DEFAULT_IDLE_MS = 5 * 60_000;

export function useLiveFixtures(options: UseLiveFixturesOptions): UseLiveFixturesResult {
  const { initial, intervalMs, enabled, idleIntervalMs = DEFAULT_IDLE_MS } = options;
  const [fixtures, setFixtures] = useState<ApiFixture[]>(initial);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const fixturesRef = useRef<ApiFixture[]>(initial);

  const fetchOnce = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (isMountedRef.current) setIsLoading(true);
    try {
      const res = await fetch("/api/fixtures/live", { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { fixtures: ApiFixture[] };
      if (!isMountedRef.current) return;
      fixturesRef.current = json.fixtures;
      setFixtures(json.fixtures);
      setError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (!isMountedRef.current) return;
      setError(e as Error);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    // Active (something live in our leagues) → fast cadence; idle → slow, just
    // enough to notice a kickoff. The FIRST poll always uses intervalMs.
    const nextDelay = () =>
      fixturesRef.current.length > 0 ? intervalMs : idleIntervalMs;

    const tick = async () => {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        await fetchOnce();
      }
      if (!isMountedRef.current) return;
      timer = setTimeout(tick, nextDelay());
    };

    timer = setTimeout(tick, intervalMs);

    return () => {
      isMountedRef.current = false;
      if (timer) clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, idleIntervalMs, fetchOnce]);

  return { fixtures, isLoading, error };
}
