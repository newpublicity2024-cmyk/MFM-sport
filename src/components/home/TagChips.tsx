"use client";

import { useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LATEST_KEY } from "@/lib/home/latestNewsTags";

/** One chip: a tag, a league… anything with an id and a name. */
export type Chip = {
  id: string;
  name: string;
  /** Optional crest shown before the name (league chips). */
  logoUrl?: string;
};

type Props = {
  /** The filters, in order. An "all" chip is always rendered first. */
  chips: Chip[];
  /** LATEST_KEY = nothing selected (the unfiltered list), else a chip id. */
  selectedId: string;
  onSelect: (id: string) => void;
  locale: string;
  /** Label of the leading chip that clears the filter. */
  allLabel: string;
  /** Accessible name of the chip row. */
  label: string;
  /** Show prev/next scroll arrows at lg and up (touch scrolls on mobile). */
  arrows?: boolean;
  className?: string;
};

/**
 * A single-row, horizontally slidable strip of filter chips. Chosen chip is
 * `aria-pressed`. Swipes on touch; on desktop, optional arrows page the strip
 * and the row never wraps, so however many chips it holds the section header
 * keeps its height. Rendered once: place it in a wrapping flex header with
 * `basis-full lg:basis-auto lg:flex-1` and it drops under the title on mobile
 * and sits beside it on desktop.
 */
export function TagChips({
  chips,
  selectedId,
  onSelect,
  locale,
  allLabel,
  label,
  arrows = false,
  className,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

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

  const all: Chip[] = [{ id: LATEST_KEY, name: allLabel }, ...chips];

  return (
    <div className={cn("relative min-w-0", className)}>
      {arrows && (
        <>
          <div className="pointer-events-none absolute inset-y-0 start-0 z-10 hidden items-center lg:flex">
            <button
              type="button"
              aria-label="Scroll tags to start"
              onClick={() => scroll("start")}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
          <div className="pointer-events-none absolute inset-y-0 end-0 z-10 hidden items-center lg:flex">
            <button
              type="button"
              aria-label="Scroll tags to end"
              onClick={() => scroll("end")}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </>
      )}
      <div
        ref={scrollerRef}
        role="group"
        aria-label={label}
        data-tag-chips
        className={cn(
          "flex snap-x gap-2 overflow-x-auto no-scrollbar whitespace-nowrap py-0.5",
          arrows && "lg:px-9",
        )}
      >
        {all.map((chip) => {
          const isActive = chip.id === selectedId;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onSelect(chip.id)}
              aria-pressed={isActive}
              className={cn(
                "flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-foreground hover:border-primary/40 hover:bg-primary/10",
              )}
            >
              {chip.logoUrl && (
                <Image src={chip.logoUrl} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
              )}
              {chip.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
