"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** YYYY-MM-DD */
  selected: string;
  /** YYYY-MM-DD — gets the accent dot. */
  today: string;
  onSelect: (date: string) => void;
  locale: string;
  /** Days shown either side of today. */
  span?: number;
  /** Label for the native date picker. */
  dateLabel: string;
  /** Accessible name of the strip. */
  label: string;
  className?: string;
};

export function shiftDate(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function dayLabel(date: string, locale: string): { day: string; num: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const day = dt.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
  const num = String(dt.getUTCDate());
  return { day, num };
}

/**
 * The matches page's date strip, made slidable and stateful for the homepage:
 * a row of day pills (weekday + number) centred on today that swipes on touch
 * and pages with arrows on desktop, plus the same native date picker. Picking
 * a day outside the strip re-centres the strip on it.
 */
export function DayCarousel({
  selected,
  today,
  onSelect,
  locale,
  span = 7,
  dateLabel,
  label,
  className,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Centre the strip on whichever day is inside it: today by default, the
  // picked day otherwise.
  const centre = isWithin(selected, today, span) ? today : selected;
  const days = Array.from({ length: span * 2 + 1 }, (_, i) => shiftDate(centre, i - span));

  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLElement>('[aria-current="date"]');
    // jsdom has no scrollIntoView; browsers do.
    el?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [selected]);

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

  // Arrows are flex siblings of the strip, never overlays over its first or
  // last pill.
  const arrowClass =
    "hidden h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted lg:flex";

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
        <button
          type="button"
          aria-label="Scroll days to start"
          onClick={() => scroll("start")}
          className={arrowClass}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
        <div
          ref={scrollerRef}
          role="group"
          aria-label={label}
          data-day-carousel
          className="flex min-w-0 flex-1 snap-x gap-1.5 overflow-x-auto no-scrollbar py-0.5"
        >
          {days.map((d) => {
            const { day, num } = dayLabel(d, locale);
            const isSelected = d === selected;
            const isToday = d === today;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelect(d)}
                aria-current={isSelected ? "date" : undefined}
                aria-label={d}
                className={cn(
                  "relative flex min-w-[3.5rem] shrink-0 snap-start flex-col items-center justify-center rounded-lg px-3 py-1.5 text-xs transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="capitalize">{day}</span>
                <span className="text-base font-semibold leading-tight">{num}</span>
                {isToday && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute bottom-1 h-1 w-1 rounded-full",
                      isSelected ? "bg-primary-foreground" : "bg-primary",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Scroll days to end"
          onClick={() => scroll("end")}
          className={arrowClass}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{dateLabel}</span>
        <input
          type="date"
          value={selected}
          onChange={(e) => {
            if (e.target.value) onSelect(e.target.value);
          }}
          className="rounded-md bg-secondary px-2 py-1 text-xs text-foreground"
        />
      </label>
    </div>
  );
}

function isWithin(date: string, centre: string, span: number): boolean {
  const a = Date.parse(`${date}T00:00:00Z`);
  const b = Date.parse(`${centre}T00:00:00Z`);
  return Math.abs(a - b) <= span * 86_400_000;
}
