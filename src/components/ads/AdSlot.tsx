"use client";

import { useEffect, useRef } from "react";
import { AD_SLOTS, ADSENSE_CLIENT_ID, type SlotFormat, type SlotName } from "@/lib/ads/slots";
import { AdLabel } from "./AdLabel";

type Props = {
  slotName: SlotName;
  format: SlotFormat;
  loading?: "eager" | "lazy";
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle?: { push: (obj: object) => void } | unknown[];
  }
}

const HEIGHT_BY_FORMAT: Record<SlotFormat, string> = {
  leaderboard: "min-h-[50px] md:min-h-[90px]",
  "in-article": "min-h-[280px]",
  "in-grid": "min-h-[280px]",
  "sticky-mobile": "min-h-[50px]",
};

export function AdSlot({ slotName, format, loading = "lazy", className = "" }: Props) {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);
  const slotId = AD_SLOTS[slotName];

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !slotId) return;
    if (pushedRef.current) return;

    const push = () => {
      if (pushedRef.current) return;
      try {
        if (!window.adsbygoogle) {
          window.adsbygoogle = [];
        }
        (window.adsbygoogle as { push: (obj: object) => void }).push({});
        pushedRef.current = true;
      } catch {
        // script blocked or not yet loaded — fail silently
      }
    };

    if (loading === "eager") {
      push();
      return;
    }

    if (!insRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          push();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(insRef.current);
    return () => observer.disconnect();
  }, [loading, slotId]);

  if (!ADSENSE_CLIENT_ID || !slotId) return null;

  return (
    <AdLabel className={className}>
      <ins
        ref={insRef}
        className={`adsbygoogle block ${HEIGHT_BY_FORMAT[format]}`}
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </AdLabel>
  );
}
