// src/components/ads/AdEmbed.tsx
"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  html: string;
  format: "banner" | "card" | "tower";
  className?: string;
};

// Reserve roughly the same footprint as the equivalent image slot so the page
// does not jump before the network fills the ad. Width matches the image slots;
// height is a min so the network's own creative size can grow it.
const WRAP: Record<Props["format"], string> = {
  banner: "mx-auto w-full max-w-[970px] min-h-[90px]",
  card: "w-full min-h-[250px]",
  tower: "w-full min-h-[600px]",
};

export function AdEmbed({ html, format, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    // Note: in React 19 dev StrictMode this effect runs twice (mount → cleanup →
    // mount), so the snippet executes twice in dev only. Harmless for standard ad
    // networks (their push calls are idempotent); production builds run it once.
    host.innerHTML = html;

    // <script> nodes inserted via innerHTML are inert. Replace each with a
    // freshly created element so the browser parses and executes it.
    const scripts = Array.from(host.querySelectorAll("script"));
    for (const old of scripts) {
      const next = document.createElement("script");
      for (const attr of Array.from(old.attributes)) {
        next.setAttribute(attr.name, attr.value);
      }
      next.text = old.textContent ?? "";
      old.replaceWith(next);
    }

    return () => {
      host.innerHTML = "";
    };
  }, [html]);

  return (
    <div
      ref={ref}
      data-ad-embed
      className={cn("flex items-center justify-center overflow-hidden", WRAP[format], className)}
    />
  );
}
