"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ApiFixture } from "@/lib/api-football/types";

export type UseLiveFixturesOptions = {
  initial: ApiFixture[];
  intervalMs: number;
  enabled: boolean;
};

export type UseLiveFixturesResult = {
  fixtures: ApiFixture[];
  isLoading: boolean;
  error: Error | null;
};

export function useLiveFixtures(options: UseLiveFixturesOptions): UseLiveFixturesResult {
  const { initial, intervalMs, enabled } = options;
  const [fixtures, setFixtures] = useState<ApiFixture[]>(initial);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

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
    if (!enabled) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fetchOnce();
    }, intervalMs);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, fetchOnce]);

  return { fixtures, isLoading, error };
}
