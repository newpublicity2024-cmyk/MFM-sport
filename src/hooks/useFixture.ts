"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ApiFixture } from "@/lib/api-football/types";

export type UseFixtureOptions = {
  initial: ApiFixture | null;
  intervalMs: number;
  enabled: boolean;
};

export type UseFixtureResult = {
  fixture: ApiFixture | null;
  isLoading: boolean;
  error: Error | null;
};

export function useFixture(id: number, options: UseFixtureOptions): UseFixtureResult {
  const { initial, intervalMs, enabled } = options;
  const [fixture, setFixture] = useState<ApiFixture | null>(initial);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hadInitialRef = useRef<boolean>(initial !== null);
  const isMountedRef = useRef(true);

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
    if (!enabled) return;

    if (!hadInitialRef.current) {
      void fetchOnce();
    }
    hadInitialRef.current = false;

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

  return { fixture, isLoading, error };
}
