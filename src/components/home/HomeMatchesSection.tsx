"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { HomeMatchRow, type HomeMatchLabels } from "./HomeMatchRow";
import { DayCarousel } from "./DayCarousel";
import { TagChips, type Chip } from "./TagChips";
import { SectionShell } from "@/components/home/SectionShell";
import { useLiveFixtures } from "@/hooks/useLiveFixtures";
import { getMatchStatus, type ApiFixture } from "@/lib/api-football/types";
import { localizeLeague } from "@/lib/api-football/localize";
import { LATEST_KEY } from "@/lib/home/latestNewsTags";

/** A league chip: id is the API-Football league id as a string. */
export type LeagueChip = Chip;

type Props = {
  title: string;
  emptyLabel: string;
  locale: string;
  /** Today's fixtures across the site's leagues, prerendered. */
  fixtures: ApiFixture[];
  /** YYYY-MM-DD, the server's today — the calendar centres on it. */
  today: string;
  /** League filter chips, in the CMS's display order. */
  leagues: LeagueChip[];
  labels: HomeMatchLabels & {
    allLeagues: string;
    leagueFilters: string;
    dateLabel: string;
    days: string;
  };
};

/** Endpoint another day's fixtures come from (see app/api/fixtures/date). */
export function fixturesByDateUrl(date: string): string {
  return `/api/fixtures/date?date=${encodeURIComponent(date)}`;
}

const STATUS_RANK: Record<string, number> = { live: 0, scheduled: 1, finished: 2, other: 3 };

function byStatusThenTime(a: ApiFixture, b: ApiFixture): number {
  const ra = STATUS_RANK[getMatchStatus(a.fixture.status.short)] ?? 3;
  const rb = STATUS_RANK[getMatchStatus(b.fixture.status.short)] ?? 3;
  if (ra !== rb) return ra - rb;
  return a.fixture.timestamp - b.fixture.timestamp;
}

type LeagueGroup = { league: ApiFixture["league"]; fixtures: ApiFixture[] };

/**
 * Group a day's fixtures by league, keeping the CMS's league order (the order
 * of `leagues`) and, inside a group, live → upcoming → finished by kick-off.
 * Leagues the CMS does not list sort last, in first-seen order.
 */
export function groupByLeague(fixtures: ApiFixture[], leagueOrder: string[]): LeagueGroup[] {
  const groups = new Map<number, LeagueGroup>();
  for (const f of fixtures) {
    const g = groups.get(f.league.id) ?? { league: f.league, fixtures: [] };
    g.fixtures.push(f);
    groups.set(f.league.id, g);
  }
  const rank = new Map(leagueOrder.map((id, i) => [Number(id), i]));
  return [...groups.values()]
    .map((g) => ({ ...g, fixtures: g.fixtures.slice().sort(byStatusThenTime) }))
    .sort((a, b) => (rank.get(a.league.id) ?? 1e9) - (rank.get(b.league.id) ?? 1e9));
}

/**
 * The homepage's matches section: the matches page, adapted. A slidable
 * calendar picks the day (today prerendered, other days fetched), a slidable
 * row of league chips narrows it (none selected = every game that day), and
 * the games render grouped by league as expandable rows. Live scores overlay
 * today's list every minute.
 */
export function HomeMatchesSection({
  title,
  emptyLabel,
  locale,
  fixtures,
  today,
  leagues,
  labels,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedLeague, setSelectedLeague] = useState<string>(LATEST_KEY);
  const [byDate, setByDate] = useState<Record<string, ApiFixture[]>>({ [today]: fixtures });
  const [loadingDate, setLoadingDate] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const selectDate = useCallback(
    async (date: string) => {
      setSelectedDate(date);
      if (byDate[date]) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoadingDate(date);
      try {
        const res = await fetch(fixturesByDateUrl(date), { signal: ctrl.signal });
        const json = res.ok ? ((await res.json()) as { fixtures?: ApiFixture[] }) : {};
        setByDate((prev) => ({ ...prev, [date]: json.fixtures ?? [] }));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setByDate((prev) => ({ ...prev, [date]: [] }));
      } finally {
        if (abortRef.current === ctrl) setLoadingDate(null);
      }
    },
    [byDate],
  );

  const { fixtures: liveFixtures } = useLiveFixtures({
    initial: [],
    intervalMs: 60000,
    enabled: true,
  });

  const dayFixtures = byDate[selectedDate] ?? [];

  // Live scores only ever concern today's games.
  const merged = useMemo(() => {
    if (selectedDate !== today || liveFixtures.length === 0) return dayFixtures;
    const liveMap = new Map(liveFixtures.map((f) => [f.fixture.id, f]));
    return dayFixtures.map((f) => liveMap.get(f.fixture.id) ?? f);
  }, [dayFixtures, liveFixtures, selectedDate, today]);

  const filtered = useMemo(
    () =>
      selectedLeague === LATEST_KEY
        ? merged
        : merged.filter((f) => String(f.league.id) === selectedLeague),
    [merged, selectedLeague],
  );

  const leagueOrder = useMemo(() => leagues.map((l) => l.id), [leagues]);
  const groups = useMemo(() => groupByLeague(filtered, leagueOrder), [filtered, leagueOrder]);

  const firstLiveId = useMemo(
    () =>
      filtered
        .slice()
        .sort(byStatusThenTime)
        .find((f) => getMatchStatus(f.fixture.status.short) === "live")?.fixture.id ?? null,
    [filtered],
  );

  const loading = loadingDate === selectedDate;

  return (
    <SectionShell>
      <SectionHeader title={title} />

      <div className="mb-4 space-y-3">
        <DayCarousel
          selected={selectedDate}
          today={today}
          onSelect={selectDate}
          locale={locale}
          dateLabel={labels.dateLabel}
          label={labels.days}
        />
        {leagues.length > 0 && (
          <TagChips
            chips={leagues}
            selectedId={selectedLeague}
            onSelect={setSelectedLeague}
            locale={locale}
            allLabel={labels.allLeagues}
            label={labels.leagueFilters}
            arrows
          />
        )}
      </div>

      {loading ? (
        <div data-matches-loading aria-busy="true" className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-border bg-muted/40" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div
          data-matches-slider
          className="flex max-h-[32rem] snap-y snap-mandatory flex-col gap-4 overflow-y-auto no-scrollbar lg:max-h-[40rem]"
        >
          {groups.map((group) => {
            const crest = leagues.find((l) => l.id === String(group.league.id))?.logoUrl ?? group.league.logo;
            return (
              <div key={group.league.id} data-league-group className="shrink-0 snap-start">
                <div className="mb-2 flex items-center gap-2 px-1">
                  {crest && <Image src={crest} alt="" width={20} height={20} className="h-5 w-5 object-contain" />}
                  <span className="text-sm font-semibold">
                    {localizeLeague(group.league.id, group.league.name, locale)}
                  </span>
                  <span className="text-xs text-muted-foreground">{group.fixtures.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {group.fixtures.map((f) => (
                    <div key={f.fixture.id} data-match-row className="shrink-0 snap-start">
                      <HomeMatchRow
                        fixture={f}
                        locale={locale}
                        labels={labels}
                        defaultOpen={f.fixture.id === firstLiveId}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
