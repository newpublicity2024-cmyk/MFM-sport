"use client";

import { useEffect, useRef, useState } from "react";
import { MatchList } from "./MatchList";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = { leagueId: number; locale: string; pollMs?: number };

export function LiveMatches({ leagueId, locale, pollMs = 30000 }: Props) {
  const [fixtures, setFixtures] = useState<ApiFixture[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let abort: AbortController | null = null;

    async function tick() {
      if (typeof document !== "undefined" && document.hidden) return;
      abort?.abort();
      abort = new AbortController();
      try {
        const res = await fetch("/api/fixtures/live", { signal: abort.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { fixtures: ApiFixture[] };
        if (mountedRef.current) {
          setFixtures((json.fixtures ?? []).filter((f) => f.league.id === leagueId));
        }
      } catch {
        // swallow (incl. AbortError)
      }
    }

    const id = setInterval(tick, pollMs);
    void tick();
    return () => { clearInterval(id); abort?.abort(); };
  }, [leagueId, pollMs]);

  if (fixtures.length === 0) return null;
  return <MatchList fixtures={fixtures} locale={locale} groupByLeague={false} />;
}
