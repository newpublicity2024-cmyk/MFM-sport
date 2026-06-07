// src/components/ads/AdCarousel.tsx
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { AdItem } from "@/lib/payload/ads";

type Props = {
  ads: AdItem[];
  format: "banner" | "card";
  className?: string;
  intervalMs?: number;
};

export function AdCarousel({ ads, format, className, intervalMs = 5000 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = ads.length;

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => clearInterval(id);
  }, [count, paused, intervalMs]);

  if (count === 0) return null;

  const active = ads[Math.min(index, count - 1)];

  const rootClass =
    format === "banner"
      ? // Fixed 6.4:1 (32/5) ratio so a single creative (e.g. 2560x400) fits every
        // screen with no crop. ~180-210px tall on desktop, scales down on mobile.
        "relative w-full aspect-[32/5] overflow-hidden rounded-xl"
      : "relative h-full w-full overflow-hidden rounded-xl border border-border bg-background";

  const slide = (
    <Image
      key={active.id}
      src={active.imageUrl}
      alt={active.alt}
      fill
      sizes={format === "banner" ? "100vw" : "(max-width: 1024px) 100vw, 33vw"}
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
          {ads.map((ad, i) => (
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
