"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LeagueArticleCard } from "./LeagueArticleCard";
import { AdCarousel } from "@/components/ads/AdCarousel";
import type { AdItem } from "@/lib/payload/ads";
import type { LeagueCardArticle } from "@/lib/home/cards";

const AUTO_ADVANCE_MS = 5000;

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return items.length ? [items] : [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

type Props = {
  articles: LeagueCardArticle[];
  locale: string;
  ads?: AdItem[];
};

// Desktop news-by-league carousel. Renders the current page of cards as a 2x2 that
// shares the section grid's two rows via `grid-rows-subgrid` — so the card rows
// (not the leagues filter) define the row heights: the leagues panel scrolls in
// row 1 and the playlist banner / square ad fill row 2 at exactly one card-row
// tall. Returns a fragment of two grid items: the cards (cols 1-2, rows 1-2) and
// the dots (cols 1-2, row 3). 4 cards per page (or 3 + the square ad in its cell
// when an ad is active). Dots only, auto-advances and loops, pauses on
// hover/focus, honors prefers-reduced-motion. Mount with key={leagueId} so
// switching tabs resets to the first page.
export function LeagueNewsCarousel({ articles, locale, ads = [] }: Props) {
  const hasAd = ads.length > 0;
  const pageSize = hasAd ? 3 : 4;
  const pages = chunk(articles, pageSize);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const safeCurrent = pages.length ? Math.min(current, pages.length - 1) : 0;

  useEffect(() => {
    if (pages.length <= 1 || paused) return;
    const mq =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    if (mq?.matches) return;
    const id = setInterval(
      () => setCurrent((p) => (p + 1) % pages.length),
      AUTO_ADVANCE_MS,
    );
    return () => clearInterval(id);
  }, [pages.length, paused]);

  if (pages.length === 0) return null;

  const pageArticles = pages[safeCurrent] ?? [];

  return (
    <>
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2 lg:row-span-2 lg:grid-rows-subgrid"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {pageArticles.map((article) => (
          <LeagueArticleCard
            key={`${safeCurrent}-${article.id}`}
            article={article}
            locale={locale}
            className="animate-in fade-in duration-500"
          />
        ))}
        {hasAd && (
          <div key={`${safeCurrent}-ad`} className="animate-in fade-in duration-500">
            <AdCarousel ads={ads} format="card" />
          </div>
        )}
      </div>

      {pages.length > 1 && (
        <div
          className="flex justify-center gap-2 pt-1 lg:col-span-2 lg:col-start-1 lg:row-start-3"
          role="tablist"
          aria-label="news pages"
        >
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === safeCurrent}
              aria-label={`${i + 1}`}
              onClick={() => setCurrent(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === safeCurrent ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      )}
    </>
  );
}
