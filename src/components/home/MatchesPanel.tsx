"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { MatchCard } from "@/components/football/MatchCard";
import type { ApiFixture } from "@/lib/api-football/types";

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

type Props = {
  fixtures: ApiFixture[];
  locale: string;
};

export function MatchesPanel({ fixtures, locale }: Props) {
  const groups = groupAndSort(fixtures);

  const [openIds, setOpenIds] = useState<Set<number>>(
    () => new Set(groups.filter((g) => g.priority <= 1).map((g) => g.league.id)),
  );

  function toggle(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const isOpen = openIds.has(group.league.id);
        const panelId = `matches-panel-${group.league.id}`;
        return (
          <div
            key={group.league.id}
            className="rounded-xl bg-card border border-border overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(group.league.id)}
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
      })}
    </div>
  );
}
