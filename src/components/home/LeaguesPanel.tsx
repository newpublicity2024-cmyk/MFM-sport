"use client";

import Image from "next/image";
import type { League } from "@/lib/home/leagues";

type Props = {
  leagues: League[];
  selectedId: string;
  locale: string;
  onSelect: (leagueId: string) => void;
};

function pickName(league: League, locale: string): string {
  if (locale === "ar") return league.name.ar;
  if (locale === "fr") return league.name.fr;
  return league.name.en;
}

export function LeaguesPanel({ leagues, selectedId, locale, onSelect }: Props) {
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto rounded-xl border border-border bg-background p-2">
      {leagues.map((league) => {
        const isActive = league.id === selectedId;
        return (
          <button
            key={league.id}
            type="button"
            onClick={() => onSelect(league.id)}
            aria-pressed={isActive}
            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-start text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-muted"
            }`}
          >
            <Image
              src={league.logoUrl}
              alt=""
              width={20}
              height={20}
              className="shrink-0"
            />
            <span className="flex-1 truncate">{pickName(league, locale)}</span>
          </button>
        );
      })}
    </div>
  );
}
