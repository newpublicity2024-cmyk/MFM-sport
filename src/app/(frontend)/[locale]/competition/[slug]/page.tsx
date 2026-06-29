import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getCompetitionBySlug, getArticlesByCompetition } from "@/lib/payload/queries";
import { getStandings } from "@/lib/api-football/standings";
import { getFixturesByLeague, getLiveFixturesForLeagues } from "@/lib/api-football/fixtures";
import { getCurrentSeason } from "@/lib/api-football/season";
import { StandingsTable } from "@/components/football/StandingsTable";
import { LiveStandings } from "@/components/football/LiveStandings";
import { LiveMatches } from "@/components/football/LiveMatches";
import { CompetitionCountdown } from "@/components/football/CompetitionCountdown";
import { MatchList } from "@/components/football/MatchList";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

// ISR: standings/fixtures rarely change minute-to-minute. The shared cache keeps
// the underlying API calls low; this caches the rendered HTML too. (2 min)
export const revalidate = 120;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const competition = await getCompetitionBySlug(slug, locale as Config["locale"]);
  if (!competition) return { title: "Not Found" };
  return { title: `${competition.name} | MFM Sport` };
}

export default async function CompetitionPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const competition = await getCompetitionBySlug(slug, locale as Config["locale"]);
  if (!competition) notFound();

  const tComp = await getTranslations({ locale, namespace: "competition" });
  const tMatch = await getTranslations({ locale, namespace: "match" });

  const leagueId = competition.apiFootballId;
  const { season, start: seasonStart } = await getCurrentSeason(leagueId, competition.season);

  const [standings, recentFixtures, upcomingFixtures, liveForLeague, articles] = await Promise.all([
    competition.type === "league" ? getStandings(leagueId, season) : Promise.resolve([]),
    getFixturesByLeague(leagueId, season, { last: 10 }),
    getFixturesByLeague(leagueId, season, { next: 10 }),
    getLiveFixturesForLeagues([leagueId]),
    competition.category && typeof competition.category === "object"
      ? getArticlesByCompetition(competition.category.id, locale as Config["locale"], 6)
      : Promise.resolve({ docs: [] }),
  ]);

  const live = liveForLeague.length > 0;
  const hasPlayed = standings.length > 0 || recentFixtures.length > 0;
  const countdownTarget = upcomingFixtures[0]?.fixture.date
    ?? (seasonStart ? `${seasonStart}T00:00:00Z` : null);

  const standingsLabels = {
    team: tComp("team"), played: tComp("played"), won: tComp("won"),
    drawn: tComp("drawn"), lost: tComp("lost"), goalsFor: tComp("goalsFor"),
    goalsAgainst: tComp("goalsAgainst"), goalDiff: tComp("goalDiff"),
    points: tComp("points"), form: tComp("form"),
  };

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">{competition.name}</h1>

      {!hasPlayed && countdownTarget && (
        <section className="mb-10">
          <CompetitionCountdown
            targetIso={countdownTarget}
            locale={locale}
            labels={{
              startsIn: tComp("startsIn"),
              firstMatch: tComp("firstMatch"),
              days: tComp("days"),
              hours: tComp("hours"),
              minutes: tComp("minutes"),
              seconds: tComp("seconds"),
            }}
          />
        </section>
      )}

      {!hasPlayed && !countdownTarget && (
        <p className="mb-10 text-muted-foreground">{tComp("notStarted")}</p>
      )}

      <LiveMatches leagueId={leagueId} locale={locale} title={tComp("liveNow")} />

      {standings.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tComp("standings")} />
          {live ? (
            <LiveStandings
              initial={standings}
              leagueId={leagueId}
              season={season}
              locale={locale}
              labels={standingsLabels}
              live
            />
          ) : (
            <StandingsTable standings={standings} locale={locale} labels={standingsLabels} />
          )}
        </section>
      )}

      {recentFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tComp("results")} />
          <MatchList fixtures={recentFixtures} locale={locale} groupByLeague={false} />
        </section>
      )}

      {upcomingFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tComp("fixtures")} />
          <MatchList fixtures={upcomingFixtures} locale={locale} groupByLeague={false} />
        </section>
      )}

      {articles.docs.length > 0 && (
        <section>
          <SectionHeader
            title={tComp("news")}
            href={competition.category && typeof competition.category === "object"
              ? `/${locale}/category/${competition.category.slug}` : undefined}
            linkText={tComp("news")}
          />
          <ArticleGrid articles={articles.docs} locale={locale} columns={3} />
        </section>
      )}
    </div>
  );
}
