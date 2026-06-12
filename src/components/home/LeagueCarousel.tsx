"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CarouselLeague = {
  slug: string;
  name: string;
  logoUrl: string;
};

type Props = {
  leagues: CarouselLeague[];
  locale: string;
  label: string;
};

// Mobile: beIN-style logos-only strip (swipe). Desktop (lg+): logo + name pills
// with prev/next scroll arrows. Names come from props (already localized by
// getCompetitions(locale)).
export function LeagueCarousel({ leagues, locale, label }: Props) {
  const scrollerRef = useRef<HTMLElement>(null);

  if (leagues.length === 0) return null;

  function scroll(toward: "start" | "end") {
    const el = scrollerRef.current;
    if (!el) return;
    // In RTL (Arabic) the inline axis is mirrored, so the physical scrollLeft
    // sign flips: scrolling toward the start means a positive delta, not negative.
    const rtl = locale === "ar";
    const amount = el.clientWidth * 0.8;
    const sign = (toward === "start" ? -1 : 1) * (rtl ? -1 : 1);
    el.scrollBy({ left: sign * amount, behavior: "smooth" });
  }

  return (
    <div className="relative mb-4 border-b border-border pb-4">
      {/* Desktop-only scroll arrows. Logical start/end positioning + rtl:rotate-180
          on the chevrons so both the side AND the glyph mirror correctly in Arabic. */}
      <div className="pointer-events-none absolute inset-y-0 start-0 z-10 hidden items-center pb-4 lg:flex">
        <button
          type="button"
          aria-label="Scroll leagues to start"
          onClick={() => scroll("start")}
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 end-0 z-10 hidden items-center pb-4 lg:flex">
        <button
          type="button"
          aria-label="Scroll leagues to end"
          onClick={() => scroll("end")}
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>

      <nav
        ref={scrollerRef}
        aria-label={label}
        className="flex gap-5 overflow-x-auto no-scrollbar lg:gap-2 lg:px-10"
      >
        {leagues.map((league) => (
          <Link
            key={league.slug}
            href={`/${locale}/competition/${league.slug}`}
            aria-label={league.name}
            title={league.name}
            className="flex shrink-0 items-center justify-center transition hover:scale-110 lg:gap-2 lg:rounded-full lg:border lg:border-border lg:bg-muted lg:px-3 lg:py-1.5 lg:hover:scale-100 lg:hover:border-primary/40 lg:hover:bg-primary/10"
          >
            <Image
              src={league.logoUrl}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 object-contain lg:h-5 lg:w-5"
            />
            <span className="hidden whitespace-nowrap text-sm font-medium lg:inline">
              {league.name}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
