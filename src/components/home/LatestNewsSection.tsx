"use client";

import { useState } from "react";
import { LeaguePlaylistBanner } from "./LeaguePlaylistBanner";
import { LeagueNewsCarousel } from "./LeagueNewsCarousel";
import { LeagueArticleCard } from "./LeagueArticleCard";
import { ArticleSlider } from "./ArticleSlider";
import { TagChips } from "./TagChips";
import { SectionShell } from "@/components/home/SectionShell";
import { AdCarousel } from "@/components/ads/AdCarousel";
import type { LeagueCardArticle } from "@/lib/home/cards";
import type { TagChip } from "@/lib/home/latestNewsTags";
import type { AdItem } from "@/lib/payload/ads";

/** Key of the unfiltered list inside `articlesByTag`. */
export const LATEST_KEY = "";

type Props = {
  title: string;
  locale: string;
  tags: TagChip[];
  /** Keyed by tag id; `""` is the unfiltered latest list. */
  articlesByTag: Record<string, LeagueCardArticle[]>;
  labels: { all: string; tagFilters: string; empty: string };
  ads?: AdItem[];
};

/**
 * Homepage "latest news". The league filter this section used to carry is
 * gone; the filter is now a slidable row of tag chips (beside the title on
 * desktop, on its own row under it on mobile), and picking one swaps every
 * list below it to that tag's newest articles.
 */
export function LatestNewsSection({
  title,
  locale,
  tags,
  articlesByTag,
  labels,
  ads = [],
}: Props) {
  const [selectedId, setSelectedId] = useState<string>(LATEST_KEY);
  const articles = articlesByTag[selectedId] ?? [];
  // Desktop: the newest article gets the spotlight cell where the league
  // filter used to sit; the carousel pages through the rest. A list of one
  // stays in the carousel rather than leaving the 2x2 empty.
  const spotlight = articles.length > 1 ? articles[0] : undefined;
  const carouselArticles = spotlight ? articles.slice(1) : articles;

  return (
    <SectionShell>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="relative shrink-0 text-xl font-bold">
          {title}
          <span className="absolute -bottom-1 start-0 h-0.5 w-12 bg-primary" />
        </h2>
        {tags.length > 0 && (
          <TagChips
            className="hidden min-w-0 flex-1 lg:block"
            tags={tags}
            selectedId={selectedId}
            onSelect={setSelectedId}
            locale={locale}
            allLabel={labels.all}
            label={labels.tagFilters}
            arrows
          />
        )}
      </div>

      {/* Mobile: the chips take a row of their own between the title and the slider. */}
      {tags.length > 0 && (
        <TagChips
          className="mb-4 lg:hidden"
          tags={tags}
          selectedId={selectedId}
          onSelect={setSelectedId}
          locale={locale}
          allLabel={labels.all}
          label={labels.tagFilters}
        />
      )}

      {articles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {labels.empty}
        </p>
      ) : (
        <>
          {/* Desktop (lg+): 3-col grid. The carousel's current page is a 2x2 spanning
              cols 1-2 / rows 1-2 (grid-rows-subgrid, so the card rows define the row
              heights), its dots sit in row 3, the spotlight article fills row 1 of
              col 3, and the playlist banner fills row 2 (one card-row tall). The
              carousel is keyed by the selected tag so it resets to the first page
              when the filter changes. */}
          <div
            data-latest-desktop
            className="hidden gap-4 lg:grid lg:grid-cols-3 lg:grid-rows-[auto_auto_auto] lg:gap-x-4 lg:gap-y-3"
          >
            <LeagueNewsCarousel
              key={selectedId}
              articles={carouselArticles}
              locale={locale}
              ads={ads}
            />
            {spotlight && (
              <LeagueArticleCard
                article={spotlight}
                locale={locale}
                data-spotlight
                className="lg:col-start-3 lg:row-start-1"
              />
            )}
            <LeaguePlaylistBanner locale={locale} />
          </div>

          {/* Mobile (< lg): a one-at-a-time blog slider, then the ad, then the
              playlist banner. */}
          <div data-latest-mobile className="flex flex-col gap-4 lg:hidden">
            <ArticleSlider articles={articles} locale={locale} />
            {ads.length > 0 && <AdCarousel ads={ads} format="card" />}
            <LeaguePlaylistBanner locale={locale} />
          </div>
        </>
      )}
    </SectionShell>
  );
}
