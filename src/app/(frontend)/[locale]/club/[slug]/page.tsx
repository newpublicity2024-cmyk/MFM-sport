import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getClubBySlug } from "@/lib/payload/queries";
import { getPayloadClient } from "@/lib/payload/queries";
import { getFixturesByTeam } from "@/lib/api-football/fixtures";
import { getEntityLogoUrl, getImageUrl } from "@/lib/utils";
import { MatchList } from "@/components/football/MatchList";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const club = await getClubBySlug(slug, locale as Config["locale"]);
  if (!club) return { title: "Not Found" };
  return { title: `${club.name} | MFM Sport` };
}

export default async function ClubPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const club = await getClubBySlug(slug, locale as Config["locale"]);
  if (!club) notFound();

  const tClub = await getTranslations({ locale, namespace: "club" });

  const payload = await getPayloadClient();

  const [recentFixtures, upcomingFixtures, articlesResult] = await Promise.all([
    club.apiFootballId
      ? getFixturesByTeam(club.apiFootballId, 2025, { last: 5 })
      : Promise.resolve([]),
    club.apiFootballId
      ? getFixturesByTeam(club.apiFootballId, 2025, { next: 5 })
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
    <div className="container mx-auto px-4 py-8">
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
