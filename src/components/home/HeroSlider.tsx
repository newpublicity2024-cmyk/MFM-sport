"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { formatDate } from "@/lib/utils";
import type { HeroSlide } from "@/lib/home/cards";

type Props = {
  slides: HeroSlide[];
  locale: string;
};

const AUTOPLAY_MS = 6000;

export function HeroSlider({ slides, locale }: Props) {
  const count = slides.length;
  // Arrows sit on logical start/end edges (which already swap in RTL). Use SVG
  // chevrons chosen by locale so each points OUTWARD in both directions. (Text
  // glyphs like ‹/› are bidi-mirrored in RTL, so they render flipped no matter
  // which codepoint you pick — that's why the previous arrows looked wrong in
  // Arabic; SVG icons aren't mirrored.)
  const isRtl = locale === "ar";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const touchStartX = useRef<number | null>(null);

  const go = useCallback(
    (i: number) => setIndex(((i % count) + count) % count),
    [count],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  useEffect(() => {
    if (count <= 1 || paused || reducedMotion.current) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(id);
  }, [count, paused]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  }

  if (count === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl bg-secondary lg:h-full">
        <span className="text-muted-foreground">MFM Sport</span>
      </div>
    );
  }

  return (
    <div
      className="group/slider relative h-56 w-full overflow-hidden rounded-2xl lg:h-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
      aria-label="Featured articles"
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <article
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              active ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!active}
          >
            {slide.heroUrl ? (
              <Image
                src={slide.heroUrl}
                alt={slide.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 66vw"
                priority={i === 0}
                className="object-cover transition-transform duration-300 group-hover/slider:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-secondary">
                <span className="text-muted-foreground">MFM Sport</span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-scrim/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 start-0 end-0 p-6">
              {slide.categoryName && slide.categorySlug && (
                <div className="relative z-10 mb-2 inline-block">
                  <CategoryBadge
                    name={slide.categoryName}
                    slug={slide.categorySlug}
                    locale={locale}
                  />
                </div>
              )}
              <h2 className="text-[clamp(1.5rem,3vw+1rem,2.25rem)] font-bold leading-tight text-white line-clamp-3">
                <Link
                  href={`/${locale}/articles/${slide.slug}`}
                  tabIndex={active ? 0 : -1}
                  className="after:absolute after:inset-0 after:content-['']"
                >
                  {slide.title}
                </Link>
              </h2>
              {slide.publishedAt && (
                <time
                  dateTime={slide.publishedAt}
                  className="mt-2 block text-sm text-white/70"
                >
                  {formatDate(slide.publishedAt, locale)}
                </time>
              )}
            </div>
          </article>
        );
      })}

      {count > 1 && (
        <>
          {/* Prev / next */}
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute start-3 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 focus-visible:opacity-100 group-hover/slider:opacity-100"
          >
            {isRtl ? (
              <ChevronRight aria-hidden className="h-5 w-5" />
            ) : (
              <ChevronLeft aria-hidden className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute end-3 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 focus-visible:opacity-100 group-hover/slider:opacity-100"
          >
            {isRtl ? (
              <ChevronLeft aria-hidden className="h-5 w-5" />
            ) : (
              <ChevronRight aria-hidden className="h-5 w-5" />
            )}
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 start-1/2 z-20 flex -translate-x-1/2 gap-1.5 rtl:translate-x-1/2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
