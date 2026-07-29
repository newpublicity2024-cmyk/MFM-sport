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

  const scrollBy = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };

  if (layout === "carousel") {
    return (
      <div className="relative my-6" data-gallery-carousel>
        <div
          ref={scrollerRef}
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
          onClick={() => scrollBy(-1)}
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
          onClick={() => scrollBy(1)}
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
