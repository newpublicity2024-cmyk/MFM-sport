"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ApiFixture } from "@/lib/api-football/types";
import { getMatchStatus } from "@/lib/api-football/types";
import { localizeTeam } from "@/lib/api-football/localize";
import { useFixture } from "@/hooks/useFixture";
import { cn, formatDate, formatTime } from "@/lib/utils";

type Props = {
  initial: ApiFixture;
  locale: string;
};

export function LiveScoreboard({ initial, locale }: Props) {
  const t = useTranslations("match");
  const initialStatus = getMatchStatus(initial.fixture.status.short);
  const isLive = initialStatus === "live";
  const { fixture: latest } = useFixture(initial.fixture.id, {
    initial,
    intervalMs: 30000,
    enabled: isLive,
  });
  const fixture = latest ?? initial;
  const status = getMatchStatus(fixture.fixture.status.short);
  const { home, away } = fixture.teams;
  const goals = fixture.goals;

  return (
    <div className="bg-card rounded-lg border border-border p-6 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col items-center gap-2 flex-1">
          <Image src={home.logo} alt={home.name} width={56} height={56} />
          <span className={cn("text-sm font-medium text-center", home.winner && "font-bold")}>
            {localizeTeam(home.id, home.name, locale)}
          </span>
        </div>

        <div className="flex flex-col items-center mx-4">
          {status === "scheduled" ? (
            <>
              <span className="text-2xl font-bold text-muted-foreground">vs</span>
              <span className="text-sm text-muted-foreground mt-1">
                {formatTime(fixture.fixture.date, locale)}
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 text-4xl font-bold tabular-nums">
                <span>{goals.home ?? 0}</span>
                <span className="text-muted-foreground text-2xl">-</span>
                <span>{goals.away ?? 0}</span>
              </div>
              <span
                className={cn(
                  "text-xs font-medium mt-1 px-2 py-0.5 rounded",
                  status === "live" && "bg-live/20 text-live",
                  status === "finished" && "bg-secondary text-muted-foreground",
                )}
              >
                {status === "live"
                  ? `${t("live")} ${fixture.fixture.status.elapsed || ""}'`
                  : t("fullTime")}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 flex-1">
          <Image src={away.logo} alt={away.name} width={56} height={56} />
          <span className={cn("text-sm font-medium text-center", away.winner && "font-bold")}>
            {localizeTeam(away.id, away.name, locale)}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
        <span>{formatDate(fixture.fixture.date, locale)}</span>
        {fixture.fixture.venue?.name && <span>{fixture.fixture.venue.name}</span>}
        {fixture.fixture.referee && <span>{fixture.fixture.referee}</span>}
      </div>
    </div>
  );
}
