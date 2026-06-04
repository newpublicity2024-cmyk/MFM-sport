"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { MatchEvents } from "@/components/football/MatchEvents";
import { cn, formatTime } from "@/lib/utils";
import { getMatchStatus, type ApiFixture } from "@/lib/api-football/types";
import { localizeTeam, localizeLeague, localizeRound } from "@/lib/api-football/localize";

export type HomeMatchLabels = {
  liveNow: string;
  events: string;
  venue: string;
  referee: string;
  viewFullMatch: string;
  loadingDetails: string;
  noEvents: string;
};

type Props = {
  fixture: ApiFixture;
  locale: string;
  labels: HomeMatchLabels;
  defaultOpen?: boolean;
};

export function HomeMatchRow({ fixture, locale, labels, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [detail, setDetail] = useState<ApiFixture | null>(null);
  const [loading, setLoading] = useState(false);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const fetchingRef = useRef(false);
  const detailRef = useRef<ApiFixture | null>(null);

  const status = getMatchStatus(fixture.fixture.status.short);
  const { home, away } = fixture.teams;
  const goals = fixture.goals;
  const fixtureId = fixture.fixture.id;
  const panelId = `home-match-${fixtureId}`;

  const loadDetail = useCallback(async () => {
    if (detailRef.current || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`/api/fixtures/${fixtureId}`, { signal: ctrl.signal });
      if (res.ok) {
        const json = (await res.json()) as { fixture: ApiFixture };
        detailRef.current = json.fixture;
        if (mountedRef.current) setDetail(json.fixture);
      }
    } catch {
      // swallow (including AbortError) — panel falls back to embedded fixture data
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Fetch details whenever the panel is open — covers user-expand and the
  // defaultOpen (auto-open first live match) case. loadDetail no-ops if already
  // fetched or in flight.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) void loadDetail();
  }, [open, loadDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggle() {
    setOpen((v) => !v);
  }

  const events = detail?.events ?? fixture.events ?? [];
  const referee = detail?.fixture.referee ?? fixture.fixture.referee;

  return (
    <div className="rounded-xl bg-background border border-border overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-3 py-3 text-start hover:bg-muted/50 transition-colors"
      >
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className={cn("text-sm truncate text-end", home.winner && "font-bold")}>
            {localizeTeam(home.id, home.name, locale)}
          </span>
          <Image src={home.logo} alt={home.name} width={24} height={24} className="shrink-0" />
        </div>

        {/* Score / kickoff time */}
        <div className="flex flex-col items-center shrink-0 min-w-[64px]">
          {status === "scheduled" ? (
            <span className="text-sm text-muted-foreground">
              {formatTime(fixture.fixture.date, locale)}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 font-bold tabular-nums">
              <span>{goals.home ?? "-"}</span>
              <span className="text-muted-foreground">-</span>
              <span>{goals.away ?? "-"}</span>
            </div>
          )}
          <span
            className={cn(
              "mt-0.5 text-[10px] font-medium",
              status === "live" ? "text-live" : "text-muted-foreground",
            )}
          >
            {status === "live"
              ? fixture.fixture.status.elapsed
                ? `${fixture.fixture.status.elapsed}' ${labels.liveNow}`
                : labels.liveNow
              : status === "finished"
                ? "FT"
                : ""}
          </span>
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Image src={away.logo} alt={away.name} width={24} height={24} className="shrink-0" />
          <span className={cn("text-sm truncate", away.winner && "font-bold")}>
            {localizeTeam(away.id, away.name, locale)}
          </span>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div id={panelId} className="border-t border-border/50 px-3 py-3 space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {localizeLeague(fixture.league.id, fixture.league.name, locale)}
              {fixture.league.round ? ` · ${localizeRound(fixture.league.round, locale)}` : ""}
            </span>
            {fixture.fixture.venue?.name && (
              <span>
                {labels.venue}: {fixture.fixture.venue.name}
              </span>
            )}
            {referee && (
              <span>
                {labels.referee}: {referee}
              </span>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{labels.loadingDetails}</p>
          ) : events.length > 0 ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">{labels.events}</h4>
              <MatchEvents events={events} homeTeamId={home.id} locale={locale} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{labels.noEvents}</p>
          )}

          <Link
            href={`/${locale}/matches/${fixtureId}`}
            className="inline-block text-sm text-primary hover:underline"
          >
            {labels.viewFullMatch} &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
