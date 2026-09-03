"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { MatchCard } from "@/components/football/MatchCard";
import { useLiveFixtures } from "@/hooks/useLiveFixtures";
import { getMatchStatus, type ApiFixture, type MatchStatus } from "@/lib/api-football/types";
import { localizeLeague } from "@/lib/api-football/localize";

type FilterStatus = Exclude<MatchStatus, "other">;

type LeagueGroup = {
  league: ApiFixture["league"];
  fixtures: ApiFixture[];
  priority: number;
};

/**
 * Group ordering. `leagueOrder` is the Competitions collection's displayOrder,
 * keyed by API-Football league id — an editor's ranking, so it wins. Fixtures
 * from leagues the CMS does not list (upstream returns whatever is playing)
 * fall back to the name/country heuristic, offset past the CMS range so a
 * listed competition always outranks an unlisted one.
 */
const UNLISTED_PRIORITY_BASE = 1_000_000;

function getLeaguePriority(
  league: ApiFixture["league"],
  leagueOrder?: Record<number, number>,
): number {
  const configured = leagueOrder?.[league.id];
  if (typeof configured === "number") return configured;

  const name = league.name.toLowerCase();
  const country = league.country.toLowerCase();
  if (name.includes("botola") || country === "morocco") return UNLISTED_PRIORITY_BASE;
  if (
    country === "europe" ||
    name.includes("champions league") ||
    name.includes("europa league") ||
    name.includes("conference league")
  )
    return UNLISTED_PRIORITY_BASE + 1;
  return UNLISTED_PRIORITY_BASE + 2;
}

// Order fixtures within a league group: finished games first, newest played on
// top (most recent result leads); upcoming/live games follow, soonest first.
function sortFixtures(a: ApiFixture, b: ApiFixture): number {
  const aFinished = getMatchStatus(a.fixture.status.short) === "finished";
  const bFinished = getMatchStatus(b.fixture.status.short) === "finished";
  if (aFinished !== bFinished) return aFinished ? -1 : 1;
  const ta = new Date(a.fixture.date).getTime();
  const tb = new Date(b.fixture.date).getTime();
  return aFinished ? tb - ta : ta - tb;
}

function groupAndSort(
  fixtures: ApiFixture[],
  leagueOrder?: Record<number, number>,
): LeagueGroup[] {
  const map = new Map<number, LeagueGroup>();
  for (const f of fixtures) {
    const id = f.league.id;
    if (!map.has(id)) {
      map.set(id, {
        league: f.league,
        fixtures: [],
        priority: getLeaguePriority(f.league, leagueOrder),
      });
    }
    map.get(id)!.fixtures.push(f);
  }
  for (const group of map.values()) {
    group.fixtures.sort(sortFixtures);
  }
  return Array.from(map.values()).sort((a, b) => a.priority - b.priority);
}

const FILTER_ORDER: FilterStatus[] = ["finished", "live", "scheduled"];

type StatusLabels = {
  finished: string;
  live: string;
  scheduled: string;
};

type Props = {
  fixtures: ApiFixture[];
  locale: string;
  statusLabels: StatusLabels;
  /**
   * The league group to start expanded — the featured competition chosen in
   * Homepage Settings. Omitted (or absent from the fixtures) means every group
   * starts collapsed, which is what happens on the lower matches section.
   */
  openLeagueId?: number | null;
  /** API-Football league id → CMS crest, overriding the upstream logo. */
  logoOverrides?: Record<number, string>;
  /** API-Football league id → Competitions displayOrder. */
  leagueOrder?: Record<number, number>;
};

export function MatchesPanel({
  fixtures,
  locale,
  statusLabels,
  openLeagueId,
  logoOverrides,
  leagueOrder,
}: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterStatus | null>(null);

  const { fixtures: liveFixtures } = useLiveFixtures({
    initial: [],
    intervalMs: 60000,
    enabled: true,
  });

  const merged = useMemo(() => {
    if (liveFixtures.length === 0) return fixtures;
    const liveMap = new Map(liveFixtures.map((f) => [f.fixture.id, f]));
    return fixtures.map((f) => liveMap.get(f.fixture.id) ?? f);
  }, [fixtures, liveFixtures]);

  const filtered = useMemo(() => {
    if (!activeFilter) return merged;
    return merged.filter(
      (f) => getMatchStatus(f.fixture.status.short) === activeFilter,
    );
  }, [merged, activeFilter]);

  const groups = useMemo(
    () => groupAndSort(filtered, leagueOrder),
    [filtered, leagueOrder],
  );

  // The featured competition's group starts open; every other group starts
  // collapsed. With no featured competition, nothing auto-opens.
  const [openIds, setOpenIds] = useState<Set<number>>(
    () => new Set(typeof openLeagueId === "number" ? [openLeagueId] : []),
  );

  function toggleLeague(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFilter(status: FilterStatus) {
    setActiveFilter((prev) => (prev === status ? null : status));
  }

  if (fixtures.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-0 z-10 flex gap-1.5 rounded-xl border border-border bg-card/95 p-1.5 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        {FILTER_ORDER.map((status) => {
          const isActive = activeFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleFilter(status)}
              aria-pressed={isActive}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              {statusLabels[status]}
            </button>
          );
        })}
      </div>

      <div
        data-leagues-slider
        className="flex flex-col gap-2 overflow-y-auto no-scrollbar snap-y snap-mandatory max-h-[19rem] lg:max-h-none lg:overflow-visible"
      >
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {activeFilter ? statusLabels[activeFilter] : ""}
        </div>
      ) : (
        groups.map((group) => {
          const isOpen = openIds.has(group.league.id);
          const panelId = `matches-panel-${group.league.id}`;
          const leagueLogo = logoOverrides?.[group.league.id] ?? group.league.logo;
          return (
            <div
              key={group.league.id}
              className="shrink-0 snap-start rounded-xl bg-background border border-border overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleLeague(group.league.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                aria-expanded={isOpen}
                aria-controls={panelId}
              >
                {leagueLogo && (
                  <Image
                    src={leagueLogo}
                    alt={group.league.name}
                    width={18}
                    height={18}
                    className="shrink-0"
                  />
                )}
                <span className="flex-1 text-start text-sm font-semibold truncate">
                  {localizeLeague(group.league.id, group.league.name, locale)}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {group.fixtures.length}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div
                  id={panelId}
                  className="divide-y divide-border/50 border-t border-border/50"
                >
                  {group.fixtures.map((f) => (
                    <MatchCard key={f.fixture.id} fixture={f} locale={locale} />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
      </div>
    </div>
  );
}
