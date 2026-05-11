"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Props = {
  selected: string; // YYYY-MM-DD
  locale: string;
  basePath: string;
  league?: string;
};

function shiftDate(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function buildHref(basePath: string, date: string, league?: string): string {
  const params = new URLSearchParams({ date });
  if (league) params.set("league", league);
  return `${basePath}?${params.toString()}`;
}

function dayLabel(date: string, locale: string): { day: string; num: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
  const num = String(dt.getUTCDate());
  return { day, num };
}

export function DateStrip({ selected, locale, basePath, league }: Props) {
  const router = useRouter();
  const days = [-3, -2, -1, 0, 1, 2, 3].map((offset) => shiftDate(selected, offset));

  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <div className="flex gap-1 overflow-x-auto">
        {days.map((d) => {
          const { day, num } = dayLabel(d, locale);
          const isSelected = d === selected;
          return (
            <Link
              key={d}
              href={buildHref(basePath, d, league)}
              aria-current={isSelected ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center rounded-md px-3 py-2 min-w-[3.5rem] text-xs transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="capitalize">{day}</span>
              <span className="text-base font-semibold">{num}</span>
            </Link>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Date</span>
        <input
          type="date"
          value={selected}
          onChange={(e) => {
            const next = e.target.value;
            if (next) router.push(buildHref(basePath, next, league));
          }}
          className="bg-secondary text-foreground rounded-md px-2 py-1 text-xs"
        />
      </label>
    </div>
  );
}
