"use client";

import { useState } from "react";
import { LeaguesPanel } from "./LeaguesPanel";
import { LeaguePlaylistBanner } from "./LeaguePlaylistBanner";
import { NewsGrid2x2 } from "./NewsGrid2x2";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { SectionShell } from "@/components/home/SectionShell";
import { LEAGUES } from "@/lib/home/leagues";
import type { LeagueCardArticle } from "@/lib/home/cards";
import type { AdItem } from "@/lib/payload/ads";

type Props = {
  title: string;
  locale: string;
  articlesByLeague: Record<string, LeagueCardArticle[]>;
  ads?: AdItem[];
};

export function LeagueNewsSection({ title, locale, articlesByLeague, ads = [] }: Props) {
  const [selectedId, setSelectedId] = useState<string>(LEAGUES[0]?.id ?? "");
  const articles = articlesByLeague[selectedId] ?? [];

  return (
    <SectionShell>
      <SectionHeader title={title} />
      {/* On desktop this is a 3-col x 2-row grid: the 2x2 article grid spans cols 1-2
          (using grid-rows-subgrid so its two card rows ARE the section's two rows),
          the leagues panel sits in row 1, and the playlist banner sits in row 2 — so
          the banner aligns top and bottom with the bottom row of cards. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-[auto_auto] lg:gap-x-4 lg:gap-y-3">
        <NewsGrid2x2
          className="lg:col-span-2 lg:row-span-2 lg:grid-rows-subgrid"
          articles={articles}
          locale={locale}
          ads={ads}
        />
        <LeaguesPanel
          className="lg:col-start-3 lg:row-start-1"
          leagues={LEAGUES}
          selectedId={selectedId}
          locale={locale}
          onSelect={setSelectedId}
        />
        <LeaguePlaylistBanner locale={locale} />
      </div>
    </SectionShell>
  );
}
