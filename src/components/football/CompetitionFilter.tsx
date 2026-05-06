import Link from "next/link";
import { cn } from "@/lib/utils";

type Competition = {
  id: string | number;
  name: string;
  apiFootballId: number;
};

type Props = {
  competitions: Competition[];
  selectedLeague: string | null;
  date: string;
  basePath: string;
  allLabel: string;
};

function buildHref(basePath: string, date: string, league?: string): string {
  const params = new URLSearchParams({ date });
  if (league) params.set("league", league);
  return `${basePath}?${params.toString()}`;
}

export function CompetitionFilter({
  competitions,
  selectedLeague,
  date,
  basePath,
  allLabel,
}: Props) {
  return (
    <div className="flex gap-2 flex-wrap mb-6">
      <Link
        href={buildHref(basePath, date)}
        aria-current={selectedLeague === null ? "page" : undefined}
        className={cn(
          "rounded-full px-3 py-1 text-xs transition-colors",
          selectedLeague === null
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground hover:text-foreground",
        )}
      >
        {allLabel}
      </Link>
      {competitions.map((c) => {
        const id = String(c.apiFootballId);
        const isSelected = selectedLeague === id;
        return (
          <Link
            key={c.id}
            href={buildHref(basePath, date, id)}
            aria-current={isSelected ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {c.name}
          </Link>
        );
      })}
    </div>
  );
}
