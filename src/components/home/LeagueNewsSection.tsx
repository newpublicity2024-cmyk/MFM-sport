"use client";

import { useState } from "react";
import { LeaguesPanel } from "./LeaguesPanel";
import { LeaguePlaylistBanner } from "./LeaguePlaylistBanner";
import { NewsGrid2x2 } from "./NewsGrid2x2";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { SectionShell } from "@/components/home/SectionShell";
import { LEAGUES } from "@/lib/home/leagues";
import type { LeagueCardArticle } from "@/lib/home/cards";

type Props = {
  title: string;
  locale: string;
  articlesByLeague: Record<string, LeagueCardArticle[]>;
};

export function LeagueNewsSection({ title, locale, articlesByLeague }: Props) {
  const [selectedId, setSelectedId] = useState<string>(LEAGUES[0]?.id ?? "");
  const articles = articlesByLeague[selectedId] ?? [];

  return (
    <SectionShell>
      <SectionHeader title={title} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NewsGrid2x2 articles={articles} locale={locale} />
        </div>
        <div className="flex flex-col gap-3">
          <LeaguesPanel
            leagues={LEAGUES}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
          <LeaguePlaylistBanner locale={locale} />
        </div>
      </div>
    </SectionShell>
  );
}
