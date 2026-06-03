import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getCompetitionBySlug, getArticlesByCompetition } from "@/lib/payload/queries";
import { getStandings } from "@/lib/api-football/standings";
import { getFixturesByLeague } from "@/lib/api-football/fixtures";
import { StandingsTable } from "@/components/football/StandingsTable";
import { MatchList } from "@/components/football/MatchList";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

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
  const season = competition.season;

  const [standings, recentFixtures, upcomingFixtures, articles] = await Promise.all([
    competition.type === "league" ? getStandings(leagueId, season) : Promise.resolve([]),
    getFixturesByLeague(leagueId, season, { last: 10 }),
    getFixturesByLeague(leagueId, season, { next: 10 }),
    competition.category && typeof competition.category === "object"
      ? getArticlesByCompetition(competition.category.id, locale as Config["locale"], 6)
      : Promise.resolve({ docs: [] }),
  ]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">{competition.name}</h1>

      {standings.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tComp("standings")} />
          <StandingsTable
            standings={standings}
            locale={locale}
            labels={{
              team: tComp("team"),
              played: tComp("played"),
              won: tComp("won"),
              drawn: tComp("drawn"),
              lost: tComp("lost"),
              goalsFor: tComp("goalsFor"),
              goalsAgainst: tComp("goalsAgainst"),
              goalDiff: tComp("goalDiff"),
              points: tComp("points"),
              form: tComp("form"),
            }}
          />
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
