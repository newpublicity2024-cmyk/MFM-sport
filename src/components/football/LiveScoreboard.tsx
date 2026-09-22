"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ApiFixture } from "@/lib/api-football/types";
import { getMatchStatus } from "@/lib/api-football/types";
import { describeStatus } from "@/lib/api-football/status";
import { localizeTeam } from "@/lib/api-football/localize";
import { useFixture } from "@/hooks/useFixture";
import { cn, formatTime } from "@/lib/utils";

type Props = {
  initial: ApiFixture;
  locale: string;
};

/**
 * The score card. Its centre follows the fixture's phase:
 *  - scheduled: the kick-off time (or "time to be confirmed");
 *  - live: the score and the minute, or the break/shoot-out label;
 *  - finished: the final score and how it ended (FT / AET / penalties);
 *  - anything else (postponed, cancelled, abandoned, awarded): the status
 *    label and no score — a postponed match is not a 0-0 draw.
 * Labels come from `match.status.*`; the date, venue and referee live in
 * the details card below, not here.
 */
export function LiveScoreboard({ initial, locale }: Props) {
  const t = useTranslations("match");
  // The hook self-governs: it polls a live match every 30s, stops at full time,
  // and (for a scheduled match) waits until shortly before kickoff to start.
  const { fixture: latest } = useFixture(initial.fixture.id, {
    initial,
    intervalMs: 30000,
    enabled: true,
    kickoffTs: new Date(initial.fixture.date).getTime(),
  });
  const fixture = latest ?? initial;
  const short = fixture.fixture.status.short;
  const status = getMatchStatus(short);
  const { labelKey } = describeStatus(short);
  const label = labelKey ? t(`status.${labelKey}`) : null;
  const { home, away } = fixture.teams;
  const goals = fixture.goals;
  const showScore = status === "live" || status === "finished";

  return (
    <div className="bg-card rounded-lg border border-border p-6 mb-8" data-phase={status}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col items-center gap-2 flex-1">
          <Image src={home.logo} alt={home.name} width={56} height={56} />
          <span className={cn("text-sm font-medium text-center", home.winner && "font-bold")}>
            {localizeTeam(home.id, home.name, locale)}
          </span>
        </div>

        <div className="flex flex-col items-center mx-4">
          {showScore ? (
            <div className="flex items-center gap-3 text-4xl font-bold tabular-nums">
              <span>{goals.home ?? 0}</span>
              <span className="text-muted-foreground text-2xl">-</span>
              <span>{goals.away ?? 0}</span>
            </div>
          ) : status === "scheduled" && short !== "TBD" ? (
            <span className="text-2xl font-bold text-muted-foreground">vs</span>
          ) : (
            <span className="text-2xl font-bold text-muted-foreground" aria-hidden="true">—</span>
          )}

          {status === "scheduled" && short !== "TBD" && (
            <span className="text-sm text-muted-foreground mt-1">
              {formatTime(fixture.fixture.date, locale)}
            </span>
          )}
          {status === "live" && (
            <span className="text-xs font-medium mt-1 px-2 py-0.5 rounded bg-live/20 text-live" data-status={short}>
              {label ?? `${t("live")} ${fixture.fixture.status.elapsed || ""}'`}
            </span>
          )}
          {status === "finished" && (
            <span className="text-xs font-medium mt-1 px-2 py-0.5 rounded bg-secondary text-muted-foreground" data-status={short}>
              {label ?? t("fullTime")}
            </span>
          )}
          {(status === "other" || short === "TBD") && label && (
            <span className="text-xs font-medium mt-1 px-2 py-0.5 rounded bg-secondary text-muted-foreground" data-status={short}>
              {label}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 flex-1">
          <Image src={away.logo} alt={away.name} width={56} height={56} />
          <span className={cn("text-sm font-medium text-center", away.winner && "font-bold")}>
            {localizeTeam(away.id, away.name, locale)}
          </span>
        </div>
      </div>
    </div>
  );
}
