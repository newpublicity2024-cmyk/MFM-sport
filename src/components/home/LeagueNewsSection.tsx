"use client";

import { useState } from "react";
import { LeaguesPanel } from "./LeaguesPanel";
import { LeaguePlaylistBanner } from "./LeaguePlaylistBanner";
import { LeagueNewsCarousel } from "./LeagueNewsCarousel";
import { ArticleSlider } from "./ArticleSlider";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { SectionShell } from "@/components/home/SectionShell";
import { AdCarousel } from "@/components/ads/AdCarousel";
import type { LeagueCardArticle, LeagueLite } from "@/lib/home/cards";
import type { AdItem } from "@/lib/payload/ads";

type Props = {
  title: string;
  locale: string;
  leagues: LeagueLite[];
  articlesByLeague: Record<string, LeagueCardArticle[]>;
  ads?: AdItem[];
};

export function LeagueNewsSection({ title, locale, leagues, articlesByLeague, ads = [] }: Props) {
  const [selectedId, setSelectedId] = useState<string>(leagues[0]?.id ?? "");
  const articles = articlesByLeague[selectedId] ?? [];

  return (
    <SectionShell>
      <SectionHeader title={title} />

      {/* Desktop (lg+): 3-col grid. The article carousel spans cols 1-2 (rotating
          pages of the 2x2 grid), the leagues panel sits in row 1, and the playlist
          banner sits in row 2. The carousel is keyed by the selected league so it
          resets to the first page when the tab changes. */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3 lg:grid-rows-[auto_auto] lg:gap-x-4 lg:gap-y-3">
        <LeagueNewsCarousel
          key={selectedId}
          className="lg:col-span-2 lg:row-span-2"
          articles={articles}
          locale={locale}
          ads={ads}
        />
        <LeaguesPanel
          className="lg:col-start-3 lg:row-start-1"
          leagues={leagues}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <LeaguePlaylistBanner locale={locale} />
      </div>

      {/* Mobile (< lg): filter first, then a one-at-a-time blog slider, then the
          ad, then the playlist banner. */}
      <div className="flex flex-col gap-4 lg:hidden">
        <LeaguesPanel
          leagues={leagues}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ArticleSlider articles={articles} locale={locale} />
        {ads.length > 0 && <AdCarousel ads={ads} format="card" />}
        <LeaguePlaylistBanner locale={locale} />
      </div>
    </SectionShell>
  );
}
