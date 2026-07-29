"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import type { Media } from "@/payload-types";

type GalleryImageItem = {
  image: number | Media;
  caption?: string | null;
  id?: string | null;
};

type Props = {
  images: GalleryImageItem[] | null | undefined;
  layout: "grid" | "carousel" | null | undefined;
};

const IMAGE_SIZES = "(max-width: 640px) 50vw, 33vw";

/**
 * Whether the nearest explicit `dir` ancestor (including `el` itself) is RTL
 * -- the same underlying fact LeagueCarousel.tsx's `locale === "ar"` prop
 * check encodes, read from the DOM instead of a prop. Gallery is invoked
 * through Payload's JSXConvertersFunction (a fixed-signature callback
 * RichText calls internally with no locale to pass down), so threading a
 * `locale` prop here would mean changing ArticleBody.tsx,
 * InArticleAdInjector.tsx, richTextConverters.tsx's exported shape, AND every
 * one of their callers -- reading the DOM is the narrow substitute for a
 * single component, not a second RTL-detection strategy: it resolves to the
 * exact same boolean `[locale]/layout.tsx` already renders (`dir={direction}`
 * on the ancestor `<div>` wrapping this component), for the same reason
 * `closest()` is how the browser itself resolves bidi direction.
 */
function isEffectivelyRtl(el: Element): boolean {
  return el.closest("[dir]")?.getAttribute("dir") === "rtl";
}

export function Gallery({ images, layout }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Skip items whose `image` relation isn't populated (a bare id) rather than
  // throwing -- mirrors the same defensive guard the image converter and
  // Payload's own default upload converter use for unpopulated relations.
  const items = (Array.isArray(images) ? images : []).filter(
    (item): item is GalleryImageItem & { image: Media } =>
      Boolean(item) && typeof item.image === "object" && item.image !== null && Boolean(item.image.url),
  );

  if (items.length === 0) return null;

  const scrollBy = (toward: "start" | "end") => {
    const el = scrollerRef.current;
    if (!el) return;
    // Same RTL model as LeagueCarousel.tsx's scroll() -- do not "simplify"
    // this away. In RTL (Arabic, this site's only served locale -- see
    // [locale]/layout.tsx) the inline axis is mirrored, so the physical
    // scrollLeft sign flips too: evergreen browsers use the negative-
    // scrollLeft RTL model, where 0 is the start (right) edge and moving
    // toward later content needs a NEGATIVE delta. Without this flip, "toward
    // start" and "toward end" are physically SWAPPED for every RTL reader --
    // this is the third time this exact class of RTL defect has been fixed on
    // this repo (PRs #30, #31, and this file's own arrow-glyph fix last round).
    const rtl = isEffectivelyRtl(el);
    const amount = el.clientWidth * 0.9;
    const sign = (toward === "start" ? -1 : 1) * (rtl ? -1 : 1);
    el.scrollBy({ left: sign * amount, behavior: "smooth" });
  };

  if (layout === "carousel") {
    return (
      <div className="relative my-6" data-gallery-carousel>
        <div
          ref={scrollerRef}
          data-gallery-scroller
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth"
        >
          {items.map((item, index) => (
            <figure
              key={item.id ?? index}
              className="relative aspect-[4/3] w-4/5 flex-none snap-center overflow-hidden rounded-lg sm:w-1/2 lg:w-1/3"
            >
              <Image
                src={item.image.url as string}
                alt={item.image.alt || ""}
                fill
                sizes={IMAGE_SIZES}
                loading={index === 0 ? "eager" : "lazy"}
                className="object-cover"
              />
              {item.caption && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-xs text-white" dir="rtl">
                  {item.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
        <button
          type="button"
          onClick={() => scrollBy("start")}
          aria-label="السابق"
          className="absolute start-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow"
        >
          {/* Logical start/end positioning + rtl:rotate-180 on the chevron itself,
              matching LeagueCarousel.tsx / HeroSlider.tsx -- a bare "‹" text glyph
              is bidi-mirrored by the browser in RTL, which is the exact defect PRs
              #30 and #31 fixed elsewhere on this repo. */}
          <ChevronLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />
        </button>
        <button
          type="button"
          onClick={() => scrollBy("end")}
          aria-label="التالي"
          className="absolute end-1 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow"
        >
          <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-3" data-gallery-grid>
      {items.map((item, index) => (
        <figure key={item.id ?? index} className="relative aspect-square overflow-hidden rounded-lg">
          <Image
            src={item.image.url as string}
            alt={item.image.alt || ""}
            fill
            sizes={IMAGE_SIZES}
            loading={index === 0 ? "eager" : "lazy"}
            className="object-cover"
          />
          {item.caption && (
            <figcaption className="mt-1 text-xs text-muted-foreground" dir="rtl">
              {item.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
