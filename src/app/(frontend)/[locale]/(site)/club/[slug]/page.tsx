import type { Metadata } from "next";
import type { Competition, Config } from "@/payload-types";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { onDemandOnly } from "@/lib/seo/isr";
import { getClubBySlug } from "@/lib/payload/queries";
import { getPayloadClient } from "@/lib/payload/queries";
import { getFixturesByTeam } from "@/lib/api-football/fixtures";
import { getCurrentSeason, seasonYearFallback } from "@/lib/api-football/season";
import { getEntityLogoUrl } from "@/lib/utils";
import { MatchList } from "@/components/football/MatchList";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

// ISR: a club's recent/upcoming fixtures change slowly; cache the rendered HTML.
export const revalidate = 900;
// Required for the `revalidate` above to take effect at all — see lib/seo/isr.ts.
export const generateStaticParams = onDemandOnly;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const club = await getClubBySlug(slug, locale as Config["locale"]);
  if (!club) notFound();
  return { title: `${club.name} | MFM Sport` };
}

export default async function ClubPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const club = await getClubBySlug(slug, locale as Config["locale"]);
  if (!club) notFound();

  // The season used to be the literal 2025, which was already the previous
  // season by the time this was measured (September 2026): every club page
  // showed last year's "recent" and "upcoming" fixtures. Take it from the
  // club's first competition, the same way the competition page does.
  const competition = club.competitions?.find(
    (c): c is Competition => typeof c === "object" && c !== null,
  );
  const [tClub, payload, season] = await Promise.all([
    getTranslations({ locale, namespace: "club" }),
    getPayloadClient(),
    competition
      ? getCurrentSeason(competition.apiFootballId, competition.season).then((s) => s.season)
      : Promise.resolve(seasonYearFallback()),
  ]);

  const [recentFixtures, upcomingFixtures, articlesResult] = await Promise.all([
    club.apiFootballId
      ? getFixturesByTeam(club.apiFootballId, season, { last: 5 })
      : Promise.resolve([]),
    club.apiFootballId
      ? getFixturesByTeam(club.apiFootballId, season, { next: 5 })
      : Promise.resolve([]),
    payload.find({
      collection: "articles",
      where: {
        status: { equals: "published" },
      },
      locale: locale as Config["locale"],
      limit: 6,
      sort: "-publishedAt",
      depth: 2,
    }),
  ]);

  const logoUrl = getEntityLogoUrl(club);

  return (
    <div className="container py-8">
      {/* Club header */}
      <div className="flex items-center gap-4 mb-8">
        {logoUrl && (
          <Image src={logoUrl} alt={club.name} width={64} height={64} />
        )}
        <div>
          <h1 className="text-2xl font-bold">{club.name}</h1>
          <div className="flex gap-3 text-sm text-muted-foreground mt-1">
            {club.country && <span>{club.country}</span>}
            {club.venue && (
              <>
                <span>·</span>
                <span>{tClub("venue")}: {club.venue}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent matches */}
      {recentFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tClub("recentMatches")} />
          <MatchList fixtures={recentFixtures} locale={locale} groupByLeague={false} />
        </section>
      )}

      {/* Upcoming matches */}
      {upcomingFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={tClub("upcomingMatches")} />
          <MatchList fixtures={upcomingFixtures} locale={locale} groupByLeague={false} />
        </section>
      )}

      {/* News */}
      {articlesResult.docs.length > 0 && (
        <section>
          <SectionHeader title={tClub("news")} />
          <ArticleGrid articles={articlesResult.docs} locale={locale} columns={3} />
        </section>
      )}
    </div>
  );
}
