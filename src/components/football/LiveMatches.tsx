"use client";

import { useEffect, useRef, useState } from "react";
import { MatchList } from "./MatchList";
import { SectionHeader } from "@/components/shared/SectionHeader";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = { leagueId: number; locale: string; title: string; pollMs?: number };

export function LiveMatches({ leagueId, locale, title, pollMs = 30000 }: Props) {
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
  return (
    <section className="mb-10">
      <SectionHeader title={title} />
      <MatchList fixtures={fixtures} locale={locale} groupByLeague={false} />
    </section>
  );
}
