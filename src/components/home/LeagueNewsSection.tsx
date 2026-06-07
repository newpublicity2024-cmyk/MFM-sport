"use client";

import { useState } from "react";
import { LeaguesPanel } from "./LeaguesPanel";
import { LeaguePlaylistBanner } from "./LeaguePlaylistBanner";
import { NewsGrid2x2 } from "./NewsGrid2x2";
import { ArticleSlider } from "./ArticleSlider";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { SectionShell } from "@/components/home/SectionShell";
import { AdCarousel } from "@/components/ads/AdCarousel";
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

      {/* Desktop (lg+): unchanged 3-col grid. The 2x2 article grid spans cols 1-2
          (grid-rows-subgrid so its two card rows ARE the section's two rows), the
          leagues panel sits in row 1, and the playlist banner sits in row 2. */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3 lg:grid-rows-[auto_auto] lg:gap-x-4 lg:gap-y-3">
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

      {/* Mobile (< lg): filter first, then a one-at-a-time blog slider, then the
          ad, then the playlist banner. */}
      <div className="flex flex-col gap-4 lg:hidden">
        <LeaguesPanel
          leagues={LEAGUES}
          selectedId={selectedId}
          locale={locale}
          onSelect={setSelectedId}
        />
        <ArticleSlider articles={articles} locale={locale} />
        {ads.length > 0 && (
          <div className="aspect-video">
            <AdCarousel ads={ads} format="card" />
          </div>
        )}
        <LeaguePlaylistBanner locale={locale} />
      </div>
    </SectionShell>
  );
}
