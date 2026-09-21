import Image from "next/image";
import type { ApiFixture } from "@/lib/api-football/types";
import { localizeLeague, localizeRound } from "@/lib/api-football/localize";
import { formatDate, formatKickoffDateTime } from "@/lib/utils";

export type MatchDetailsLabels = {
  details: string;
  competition: string;
  round: string;
  kickoffTime: string;
  moroccoTime: string;
  venue: string;
  referee: string;
  /** Shown instead of the clock when API-Football has no kick-off time yet (status TBD). */
  timeToBeConfirmed: string;
};

type Props = {
  fixture: ApiFixture;
  locale: string;
  labels: MatchDetailsLabels;
};

/**
 * Kooora's "تفاصيل" card: competition, round, kick-off, venue and referee.
 *
 * The kick-off is a `<time datetime>` carrying the exact UTC instant from
 * API-Football, with the text rendered in Africa/Casablanca — the one place on
 * the page a crawler can read the moment of the match unambiguously. A row is
 * omitted, not left blank, when upstream has no value for it.
 */
export function MatchDetailsCard({ fixture, locale, labels }: Props) {
  const league = localizeLeague(fixture.league.id, fixture.league.name, locale);
  const round = localizeRound(fixture.league.round, locale);
  const venue = fixture.fixture.venue;
  const isTbd = fixture.fixture.status.short === "TBD";
  const venueText = venue?.name ? [venue.name, venue.city].filter(Boolean).join("، ") : null;

  return (
    <section
      aria-labelledby="match-details-heading"
      className="bg-card rounded-lg border border-border p-4 mb-8"
    >
      <h2 id="match-details-heading" className="text-base font-bold mb-3">
        {labels.details}
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{labels.competition}</dt>
        <dd className="flex items-center gap-2 font-medium">
          {fixture.league.flag && (
            <Image src={fixture.league.flag} alt="" width={18} height={12} className="rounded-sm" />
          )}
          <span>{league}</span>
        </dd>

        {round && (
          <>
            <dt className="text-muted-foreground">{labels.round}</dt>
            <dd className="font-medium">{round}</dd>
          </>
        )}

        <dt className="text-muted-foreground">{labels.kickoffTime}</dt>
        <dd className="font-medium">
          <time dateTime={fixture.fixture.date} data-tbd={isTbd || undefined}>
            {isTbd
              ? `${formatDate(fixture.fixture.date, locale)} — ${labels.timeToBeConfirmed}`
              : formatKickoffDateTime(fixture.fixture.date, locale)}
          </time>
          {!isTbd && (
            <span className="text-muted-foreground text-xs ms-2">{labels.moroccoTime}</span>
          )}
        </dd>

        {venueText && (
          <>
            <dt className="text-muted-foreground">{labels.venue}</dt>
            <dd className="font-medium">{venueText}</dd>
          </>
        )}

        {fixture.fixture.referee && (
          <>
            <dt className="text-muted-foreground">{labels.referee}</dt>
            <dd className="font-medium">{fixture.fixture.referee}</dd>
          </>
        )}
      </dl>
    </section>
  );
}
