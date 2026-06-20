"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NewsGrid2x2 } from "./NewsGrid2x2";
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
  className?: string;
  ads?: AdItem[];
};

// Desktop news-by-league carousel: shows one page of cards at a time and rotates
// through the league's articles. Each page is the existing 2x2 grid, so the square
// ad keeps its exact placement (when an ad is present a page is 3 blogs + the ad;
// otherwise 4 blogs). Dots only (no arrows); auto-advances and loops, pausing on
// hover/focus and honoring prefers-reduced-motion. Mount with key={leagueId} so
// switching tabs resets to the first page.
export function LeagueNewsCarousel({ articles, locale, className, ads = [] }: Props) {
  const pageSize = ads.length > 0 ? 3 : 4;
  const pages = chunk(articles, pageSize);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  // Guard against the active page falling out of range if the data shrinks.
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

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Pages share one grid cell so they stack and crossfade without any layout
          jump (and no LTR/RTL transform pitfalls). */}
      <div className="grid flex-1">
        {pages.map((page, i) => (
          <div
            key={i}
            aria-hidden={i !== safeCurrent}
            className={cn(
              "col-start-1 row-start-1 transition-opacity duration-500",
              i === safeCurrent ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <NewsGrid2x2 articles={page} locale={locale} ads={ads} />
          </div>
        ))}
      </div>

      {pages.length > 1 && (
        <div className="flex justify-center gap-2 pt-1" role="tablist" aria-label="news pages">
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
    </div>
  );
}
