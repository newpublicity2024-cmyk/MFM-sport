"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TagChip } from "@/lib/home/latestNewsTags";

type Props = {
  /** The tag filters, in order. An "all" chip is always rendered first. */
  tags: TagChip[];
  /** "" = the unfiltered latest list, else a tag id. */
  selectedId: string;
  onSelect: (id: string) => void;
  locale: string;
  /** Label of the leading chip that clears the filter. */
  allLabel: string;
  /** Accessible name of the chip row. */
  label: string;
  /** Show prev/next scroll arrows (desktop only; touch scrolls on mobile). */
  arrows?: boolean;
  className?: string;
};

/**
 * A single-row, horizontally slidable strip of filter chips. Chosen chip is
 * `aria-pressed`. Swipes on touch; on desktop, optional arrows page the strip
 * and the row never wraps, so however many tags an editor adds the section
 * header keeps its height.
 */
export function TagChips({
  tags,
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

  const chips: { id: string; name: string }[] = [
    { id: "", name: allLabel },
    ...tags.map((t) => ({ id: t.id, name: t.name })),
  ];

  return (
    <div className={cn("relative min-w-0", className)}>
      {arrows && (
        <>
          <div className="pointer-events-none absolute inset-y-0 start-0 z-10 flex items-center">
            <button
              type="button"
              aria-label="Scroll tags to start"
              onClick={() => scroll("start")}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
          <div className="pointer-events-none absolute inset-y-0 end-0 z-10 flex items-center">
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
          "flex snap-x gap-2 overflow-x-auto no-scrollbar whitespace-nowrap",
          arrows && "px-9",
        )}
      >
        {chips.map((chip) => {
          const isActive = chip.id === selectedId;
          return (
            <button
              key={chip.id || "__all"}
              type="button"
              onClick={() => onSelect(chip.id)}
              aria-pressed={isActive}
              className={cn(
                "shrink-0 snap-start rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-foreground hover:border-primary/40 hover:bg-primary/10",
              )}
            >
              {chip.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
