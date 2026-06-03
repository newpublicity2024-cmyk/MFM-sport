"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { MatchCard } from "@/components/football/MatchCard";
import { useLiveFixtures } from "@/hooks/useLiveFixtures";
import { getMatchStatus, type ApiFixture, type MatchStatus } from "@/lib/api-football/types";

type FilterStatus = Exclude<MatchStatus, "other">;

type LeagueGroup = {
  league: ApiFixture["league"];
  fixtures: ApiFixture[];
  priority: number;
};

function getLeaguePriority(league: ApiFixture["league"]): number {
  const name = league.name.toLowerCase();
  const country = league.country.toLowerCase();
  if (name.includes("botola") || country === "morocco") return 0;
  if (
    country === "europe" ||
    name.includes("champions league") ||
    name.includes("europa league") ||
    name.includes("conference league")
  )
    return 1;
  return 2;
}

function groupAndSort(fixtures: ApiFixture[]): LeagueGroup[] {
  const map = new Map<number, LeagueGroup>();
  for (const f of fixtures) {
    const id = f.league.id;
    if (!map.has(id)) {
      map.set(id, {
        league: f.league,
        fixtures: [],
        priority: getLeaguePriority(f.league),
      });
    }
    map.get(id)!.fixtures.push(f);
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
};

export function MatchesPanel({ fixtures, locale, statusLabels }: Props) {
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

  const groups = useMemo(() => groupAndSort(filtered), [filtered]);

  const [openIds, setOpenIds] = useState<Set<number>>(
    () => new Set(groupAndSort(fixtures).filter((g) => g.priority <= 1).map((g) => g.league.id)),
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
      <div className="sticky top-0 z-10 flex gap-1.5 rounded-xl border border-border bg-background/95 p-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/75">
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

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {activeFilter ? statusLabels[activeFilter] : ""}
        </div>
      ) : (
        groups.map((group) => {
          const isOpen = openIds.has(group.league.id);
          const panelId = `matches-panel-${group.league.id}`;
          return (
            <div
              key={group.league.id}
              className="rounded-xl bg-background border border-border overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleLeague(group.league.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                aria-expanded={isOpen}
                aria-controls={panelId}
              >
                {group.league.logo && (
                  <Image
                    src={group.league.logo}
                    alt={group.league.name}
                    width={18}
                    height={18}
                    className="shrink-0"
                  />
                )}
                <span className="flex-1 text-start text-sm font-semibold truncate">
                  {group.league.name}
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
  );
}
