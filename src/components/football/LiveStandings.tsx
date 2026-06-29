"use client";

import { useEffect, useRef, useState } from "react";
import { StandingsTable } from "./StandingsTable";
import type { ApiStandingRow } from "@/lib/api-football/types";

type Labels = React.ComponentProps<typeof StandingsTable>["labels"];

type Props = {
  initial: ApiStandingRow[];
  leagueId: number;
  season: number;
  locale: string;
  labels: Labels;
  live: boolean;
  pollMs?: number;
};

export function LiveStandings({ initial, leagueId, season, locale, labels, live, pollMs = 30000 }: Props) {
  const [standings, setStandings] = useState(initial);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!live) return;
    let abort: AbortController | null = null;

    async function tick() {
      if (typeof document !== "undefined" && document.hidden) return;
      abort?.abort();
      abort = new AbortController();
      try {
        const res = await fetch(`/api/standings?league=${leagueId}&season=${season}`, { signal: abort.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { standings: ApiStandingRow[] };
        if (mountedRef.current && Array.isArray(json.standings) && json.standings.length > 0) {
          setStandings(json.standings);
        }
      } catch {
        // swallow (incl. AbortError) — keep last good standings
      }
    }

    const id = setInterval(tick, pollMs);
    void tick();
    return () => { clearInterval(id); abort?.abort(); };
  }, [live, leagueId, season, pollMs]);

  return <StandingsTable standings={standings} locale={locale} labels={labels} />;
}
