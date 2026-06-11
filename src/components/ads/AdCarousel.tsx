// src/components/ads/AdCarousel.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { AdItem } from "@/lib/payload/ads";
import { AdEmbed } from "./AdEmbed";

type Props = {
  ads: AdItem[];
  format: "banner" | "card" | "tower";
  className?: string;
  intervalMs?: number;
};

export function AdCarousel({ ads, format, className, intervalMs = 5000 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // A tag ad owns the slot: the network handles its own rotation/refresh, so if
  // any tag creative is present we render it standalone and ignore images.
  const tagAd = ads.find((a) => a.type === "tag" && a.embedCode);

  const imageAds = ads.filter((a) => a.type !== "tag" && a.imageUrl);
  const count = imageAds.length;

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
  }, [count, paused, intervalMs]);

  if (tagAd) {
    return <AdEmbed html={tagAd.embedCode!} format={format} className={className} />;
  }

  if (count === 0) return null;

  const active = imageAds[Math.min(index, count - 1)];

  const rootClass =
    format === "banner"
      ? // Standard 970x250 billboard: fixed ratio, capped at 970px wide, centered.
        "relative mx-auto w-full max-w-[970px] aspect-[970/250] overflow-hidden rounded-xl"
      : format === "tower"
        ? // Standard 300x600 half-page / tower. Design creatives at 300x600.
          "relative w-full aspect-[300/600] overflow-hidden rounded-xl border border-border bg-background"
        : // Standard 300x250 medium rectangle (6:5). Design creatives at 300x250.
          "relative w-full aspect-[300/250] overflow-hidden rounded-xl border border-border bg-background";

  const slide = (
    <Image
      key={active.id}
      src={active.imageUrl!}
      alt={active.alt ?? ""}
      fill
      sizes={format === "banner" ? "100vw" : "300px"}
      className="object-cover"
    />
  );

  return (
    <div
      className={cn(rootClass, className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {active.linkUrl ? (
        <a
          href={active.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 block"
        >
          {slide}
        </a>
      ) : (
        slide
      )}

      {count > 1 && (
        <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
          {imageAds.map((ad, i) => (
            <button
              key={ad.id}
              type="button"
              data-ad-dot
              aria-label={`Show ad ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
