import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { onDemandOnly } from "@/lib/seo/isr";
import { getFixtureById } from "@/lib/api-football/fixtures";
import { MatchHeader } from "@/components/football/MatchHeader";
import { MatchDetailsCard } from "@/components/football/MatchDetailsCard";
import { MatchEvents } from "@/components/football/MatchEvents";
import { MatchLineup } from "@/components/football/MatchLineup";
import { MatchStats } from "@/components/football/MatchStats";
import { StandingsExcerptBlock } from "@/components/football/blocks/StandingsExcerptBlock";
import { RecentResultsBlock } from "@/components/football/blocks/RecentResultsBlock";
import { HeadToHeadBlock } from "@/components/football/blocks/HeadToHeadBlock";
import { BlockSkeleton } from "@/components/football/blocks/BlockSkeleton";
import { WinnerPoll } from "@/components/football/WinnerPoll";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { localizeLeague, localizeTeam } from "@/lib/api-football/localize";
import { isIndexableFixture } from "@/lib/seo/matchIndexing";
import { matchJsonLd } from "@/lib/seo/matchJsonLd";
import { isVotingOpen } from "@/lib/poll/voting";
import { formatDate } from "@/lib/utils";

// ISR: regenerate the match shell at most once a minute; live score/events
// still stream client-side via LiveScoreboard polling the cached fixture API.
export const revalidate = 60;
// Required for the `revalidate` above to take effect at all — see lib/seo/isr.ts.
export const generateStaticParams = onDemandOnly;

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const fixture = await getFixtureById(Number(id));
  // Raised here, before the response streams, so the 404 status is still
  // settable — see the same note in articles/[slug]/page.tsx.
  if (!fixture) notFound();

  const home = localizeTeam(fixture.teams.home.id, fixture.teams.home.name, locale);
  const away = localizeTeam(fixture.teams.away.id, fixture.teams.away.name, locale);
  const league = localizeLeague(fixture.league.id, fixture.league.name, locale);
  const title = `${home} ضد ${away} | MFM Sport`;

  // Casablanca date, not the server's UTC one (a 23:00Z kick-off is tomorrow here).
  const kickoff = formatDate(fixture.fixture.date, locale);
  const description = `${home} ضد ${away} في ${league}. النتيجة المباشرة، التشكيلة، الأهداف وإحصائيات المباراة يوم ${kickoff}.`;

  const indexable = isIndexableFixture(fixture);

  return {
    title,
    description,
    alternates: { canonical: `/${locale}/matches/${id}` },
    // Every fixture API-Football returns generates a crawlable URL — tens of
    // thousands of near-empty pages worldwide. Only competitions this newsroom
    // actually covers earn indexation; the rest stay reachable for deep links
    // but are kept out of the index. See lib/seo/matchIndexing.
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: "website",
      title,
      description,
      url: `/${locale}/matches/${id}`,
      siteName: "MFM Sport",
      locale: "ar_MA",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function MatchPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const fixture = await getFixtureById(Number(id));
  if (!fixture) notFound();

  const [t, tComp] = await Promise.all([
    getTranslations({ locale, namespace: "match" }),
    getTranslations({ locale, namespace: "competition" }),
  ]);
  const { home, away } = fixture.teams;

  const resultLabels = {
    win: t("resultWin"),
    draw: t("resultDraw"),
    loss: t("resultLoss"),
    atHome: t("atHome"),
    away: t("away"),
  };
  const standingsLabels = {
    captionTemplate: (competition: string) => t("standingsExcerpt", { competition }),
    fullStandings: t("fullStandings"),
    team: tComp("team"), played: tComp("played"), won: tComp("won"), drawn: tComp("drawn"),
    lost: tComp("lost"), goalsFor: tComp("goalsFor"), goalsAgainst: tComp("goalsAgainst"),
    goalDiff: tComp("goalDiff"), points: tComp("points"), form: tComp("form"),
  };

  return (
    <div className="container py-8 max-w-4xl">
      {/* What this page is about, for search engines: the event, its teams,
          kick-off instant, venue and status, plus the breadcrumb trail. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            matchJsonLd(fixture, locale, { home: t("breadcrumbHome"), matches: t("breadcrumbMatches") }),
          ),
        }}
      />

      <MatchHeader fixture={fixture} locale={locale} />

      <MatchDetailsCard
        fixture={fixture}
        locale={locale}
        labels={{
          details: t("details"),
          competition: t("competition"),
          round: t("round"),
          kickoffTime: t("kickoffTime"),
          moroccoTime: t("moroccoTime"),
          venue: t("venue"),
          referee: t("referee"),
          timeToBeConfirmed: t("status.tbd"),
        }}
      />

      {/* Events */}
      {fixture.events && fixture.events.length > 0 && (
        <section className="mb-8">
          <SectionHeader title={t("events")} />
          <div className="bg-card rounded-lg border border-border p-4">
            <MatchEvents events={fixture.events} homeTeamId={home.id} locale={locale} />
          </div>
        </section>
      )}

      {/* Statistics */}
      {fixture.statistics && fixture.statistics.length >= 2 && (
        <section className="mb-8">
          <SectionHeader title={t("statistics")} />
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex justify-between text-sm font-medium mb-4">
              <div className="flex items-center gap-2">
                <Image src={home.logo} alt={home.name} width={16} height={16} />
                <span>{localizeTeam(home.id, home.name, locale)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{localizeTeam(away.id, away.name, locale)}</span>
                <Image src={away.logo} alt={away.name} width={16} height={16} />
              </div>
            </div>
            <MatchStats statistics={fixture.statistics} />
          </div>
        </section>
      )}

      {/* Lineups */}
      {fixture.lineups && fixture.lineups.length >= 2 && (
        <section className="mb-8">
          <SectionHeader title={t("lineup")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fixture.lineups.map((lineup) => (
              <div key={lineup.team.id} className="bg-card rounded-lg border border-border p-4">
                <MatchLineup
                  lineup={lineup}
                  locale={locale}
                  labels={{
                    startingXI: t("startingXI"),
                    substitutes: t("substitutes"),
                    coach: t("coach"),
                    formation: t("formation"),
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reader prediction. A client island: the counts are volatile and
          per-visitor, so they stay out of the cached HTML and a vote never
          invalidates it. */}
      <WinnerPoll
        fixtureId={fixture.fixture.id}
        home={home}
        away={away}
        homeName={localizeTeam(home.id, home.name, locale)}
        awayName={localizeTeam(away.id, away.name, locale)}
        open={isVotingOpen(fixture)}
        labels={{
          title: t("pollTitle"),
          draw: t("pollDraw"),
          vote: t("pollVote"),
          thanks: t("pollThanks"),
          closed: t("pollClosed"),
          votes: t("pollVotes"),
          error: t("pollError"),
        }}
      />

      {/* Pre-match context: table position, form, history. Each block streams
          behind its own boundary and renders nothing on upstream trouble, so a
          quota outage costs a widget, never the page. The three read the
          shared Redis cache (standings 1 h, team form 15 min, H2H 24 h), so
          upstream cost scales with fixtures, not page views. */}
      <Suspense fallback={<BlockSkeleton className="h-80" />}>
        <StandingsExcerptBlock fixture={fixture} locale={locale} labels={standingsLabels} />
      </Suspense>
      <Suspense fallback={<BlockSkeleton className="h-96" />}>
        <RecentResultsBlock
          fixture={fixture}
          locale={locale}
          labels={{
            ...resultLabels,
            title: t("recentResults"),
            scoredIn: t("scoredIn"),
            over25: t("over25"),
            bothScored: t("bothScored"),
            noResults: t("noResults"),
          }}
        />
      </Suspense>
      <Suspense fallback={<BlockSkeleton className="h-80" />}>
        <HeadToHeadBlock
          fixture={fixture}
          locale={locale}
          labels={{
            ...resultLabels,
            title: t("headToHead", { count: 5 }),
            wins: t("wins"),
            draws: t("draws"),
            goals: t("goals"),
          }}
        />
      </Suspense>
    </div>
  );
}
