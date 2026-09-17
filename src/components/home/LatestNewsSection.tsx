"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LeaguePlaylistBanner } from "./LeaguePlaylistBanner";
import { LeagueNewsCarousel } from "./LeagueNewsCarousel";
import { LeagueArticleCard } from "./LeagueArticleCard";
import { ArticleSlider } from "./ArticleSlider";
import { TagChips } from "./TagChips";
import { SectionShell } from "@/components/home/SectionShell";
import { AdCarousel } from "@/components/ads/AdCarousel";
import type { LeagueCardArticle } from "@/lib/home/cards";
import { LATEST_KEY, type TagChip } from "@/lib/home/latestNewsTags";
import type { AdItem } from "@/lib/payload/ads";

type Props = {
  title: string;
  locale: string;
  tags: TagChip[];
  /** The unfiltered newest articles; a chip's list is fetched when selected. */
  latest: LeagueCardArticle[];
  labels: { all: string; tagFilters: string; empty: string };
  ads?: AdItem[];
};

/** Endpoint a chip's articles come from (see app/api/home/latest-news). */
export function latestNewsUrl(tagId: string, locale: string): string {
  return `/api/home/latest-news?tag=${encodeURIComponent(tagId)}&locale=${encodeURIComponent(locale)}`;
}

/**
 * Homepage "latest news". The league filter this section used to carry is
 * gone; the filter is one slidable row of tag chips under the title, listing
 * the site's most-used tags.
 * Picking a chip swaps every list below it to that tag's newest articles,
 * fetched on first use and kept for the life of the page.
 */
export function LatestNewsSection({ title, locale, tags, latest, labels, ads = [] }: Props) {
  const [selectedId, setSelectedId] = useState<string>(LATEST_KEY);
  const [lists, setLists] = useState<Record<string, LeagueCardArticle[]>>({ [LATEST_KEY]: latest });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const select = useCallback(
    async (id: string) => {
      setSelectedId(id);
      if (id === LATEST_KEY || lists[id]) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoadingId(id);
      try {
        const res = await fetch(latestNewsUrl(id, locale), { signal: ctrl.signal });
        const json = res.ok ? ((await res.json()) as { articles?: LeagueCardArticle[] }) : {};
        setLists((prev) => ({ ...prev, [id]: json.articles ?? [] }));
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setLists((prev) => ({ ...prev, [id]: [] }));
      } finally {
        if (abortRef.current === ctrl) setLoadingId(null);
      }
    },
    [lists, locale],
  );

  const articles = lists[selectedId] ?? [];
  const loading = loadingId === selectedId;
  // Desktop: the newest article gets the spotlight cell where the league
  // filter used to sit; the carousel pages through the rest. A list of one
  // stays in the carousel rather than leaving the 2x2 empty.
  const spotlight = articles.length > 1 ? articles[0] : undefined;
  const carouselArticles = spotlight ? articles.slice(1) : articles;

  return (
    <SectionShell>
      <div className="mb-3">
        <h2 className="relative inline-block text-xl font-bold">
          {title}
          <span className="absolute -bottom-1 start-0 h-0.5 w-12 bg-primary" />
        </h2>
      </div>
      {/* The chip strip has a row of its own under the title, at every width. */}
      {tags.length > 0 && (
        <TagChips
          className="mb-4"
          chips={tags}
          selectedId={selectedId}
          onSelect={select}
          locale={locale}
          allLabel={labels.all}
          label={labels.tagFilters}
          arrows
        />
      )}

      {loading ? (
        <div
          data-latest-loading
          aria-busy="true"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-border bg-background">
              <div className="aspect-video bg-muted" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-5/6 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {labels.empty}
        </p>
      ) : (
        <>
          {/* Desktop (lg+): 3-col grid. The carousel's current page is a 2x2 spanning
              cols 1-2 / rows 1-2 (grid-rows-subgrid, so the card rows define the row
              heights), its dots span all three columns in row 3, the spotlight
              article fills row 1 of col 3, and the playlist banner fills row 2 (one
              card-row tall). The carousel is keyed by the selected tag so it resets
              to the first page when the filter changes. */}
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
