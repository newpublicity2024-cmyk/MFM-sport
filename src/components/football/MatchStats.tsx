import { cn } from "@/lib/utils";
import type { ApiTeamStatistics } from "@/lib/api-football/types";

type Props = {
  statistics: ApiTeamStatistics[];
};

const STAT_KEYS = [
  "Ball Possession",
  "Total Shots",
  "Shots on Goal",
  "Corner Kicks",
  "Fouls",
  "Offsides",
  "Yellow Cards",
  "Red Cards",
  "Passes %",
];

function parseStatValue(value: number | string | null): number {
  if (value === null) return 0;
  if (typeof value === "string") return parseInt(value.replace("%", ""), 10) || 0;
  return value;
}

export function MatchStats({ statistics }: Props) {
  if (statistics.length < 2) return null;

  const [homeStats, awayStats] = statistics;

  return (
    <div className="space-y-3">
      {STAT_KEYS.map((key) => {
        const homeStat = homeStats.statistics.find((s) => s.type === key);
        const awayStat = awayStats.statistics.find((s) => s.type === key);
        if (!homeStat && !awayStat) return null;

        const homeVal = parseStatValue(homeStat?.value ?? null);
        const awayVal = parseStatValue(awayStat?.value ?? null);
        const total = homeVal + awayVal || 1;
        const homePercent = (homeVal / total) * 100;

        return (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{homeStat?.value ?? 0}</span>
              <span className="text-muted-foreground text-xs">{key}</span>
              <span className="font-medium">{awayStat?.value ?? 0}</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary">
              <div
                className={cn("rounded-full", homePercent > 50 ? "bg-primary" : "bg-muted-foreground")}
                style={{ width: `${homePercent}%` }}
              />
              <div
                className={cn("rounded-full", homePercent <= 50 ? "bg-primary" : "bg-muted-foreground")}
                style={{ width: `${100 - homePercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
