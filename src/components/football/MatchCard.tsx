import Image from "next/image";
import Link from "next/link";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { ApiFixture } from "@/lib/api-football/types";
import { getMatchStatus } from "@/lib/api-football/types";
import { localizeTeam } from "@/lib/api-football/localize";

type Props = {
  fixture: ApiFixture;
  locale: string;
};

export function MatchCard({ fixture, locale }: Props) {
  const status = getMatchStatus(fixture.fixture.status.short);
  const { home, away } = fixture.teams;
  const goals = fixture.goals;

  return (
    <Link
      href={`/${locale}/matches/${fixture.fixture.id}`}
      className="block rounded-lg bg-card border border-border p-3 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Image src={home.logo} alt={home.name} width={24} height={24} className="shrink-0" />
          <span className={cn("text-sm truncate", home.winner && "font-bold")}>
            {localizeTeam(home.id, home.name, locale)}
          </span>
        </div>

        {/* Score / Time */}
        <div className="flex flex-col items-center shrink-0 min-w-[60px]">
          {status === "scheduled" ? (
            <span className="text-xs text-muted-foreground">
              {formatTime(fixture.fixture.date, locale)}
            </span>
          ) : (
            <div className="flex items-center gap-1 font-bold tabular-nums">
              <span>{goals.home ?? "-"}</span>
              <span className="text-muted-foreground">-</span>
              <span>{goals.away ?? "-"}</span>
            </div>
          )}
          <span
            className={cn(
              "text-[10px] font-medium mt-0.5",
              status === "live" && "text-live",
              status === "finished" && "text-muted-foreground",
              status === "scheduled" && "text-muted-foreground",
            )}
          >
            {status === "live" && fixture.fixture.status.elapsed
              ? `${fixture.fixture.status.elapsed}'`
              : status === "live"
                ? fixture.fixture.status.short
                : status === "finished"
                  ? "FT"
                  : formatDate(fixture.fixture.date, locale)}
          </span>
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className={cn("text-sm truncate", away.winner && "font-bold")}>
            {localizeTeam(away.id, away.name, locale)}
          </span>
          <Image src={away.logo} alt={away.name} width={24} height={24} className="shrink-0" />
        </div>
      </div>
    </Link>
  );
}
