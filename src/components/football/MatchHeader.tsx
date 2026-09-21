import Image from "next/image";
import type { ApiFixture } from "@/lib/api-football/types";
import { localizeLeague, localizeRound, localizeTeam } from "@/lib/api-football/localize";
import { LiveScoreboard } from "./LiveScoreboard";

type Props = {
  fixture: ApiFixture;
  locale: string;
  /** Human label for states the scoreboard cannot express (postponed, TBD…); null otherwise. */
  statusLabel: string | null;
};

/**
 * The top of a match page: competition + round, the page's single `<h1>`
 * ("home ضد away", Arabic names), the live scoreboard island, and a status
 * label for the states the scoreboard's score/time centre cannot express.
 *
 * Server component. The names go through `localizeTeam`, the same dictionary
 * the `<title>` uses, so the heading and the tab title never disagree.
 */
export function MatchHeader({ fixture, locale, statusLabel }: Props) {
  const home = localizeTeam(fixture.teams.home.id, fixture.teams.home.name, locale);
  const away = localizeTeam(fixture.teams.away.id, fixture.teams.away.name, locale);
  const league = localizeLeague(fixture.league.id, fixture.league.name, locale);
  const round = localizeRound(fixture.league.round, locale);

  return (
    <header className="mb-8">
      <div className="flex items-center justify-center gap-2 mb-3 text-sm text-muted-foreground">
        <Image src={fixture.league.logo} alt="" width={20} height={20} />
        <span>{league}</span>
        {round && (
          <>
            <span aria-hidden="true">·</span>
            <span>{round}</span>
          </>
        )}
      </div>
      <h1 className="text-xl lg:text-2xl font-bold text-center mb-4">
        {home} ضد {away}
      </h1>
      <LiveScoreboard initial={fixture} locale={locale} />
      {statusLabel && (
        <p
          data-status={fixture.fixture.status.short}
          className="-mt-4 mb-4 text-center text-sm font-medium text-muted-foreground"
        >
          {statusLabel}
        </p>
      )}
    </header>
  );
}
