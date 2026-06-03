import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticles } from "@/lib/payload/queries";
import { getVideos } from "@/lib/videos";
import { getFixturesByDate } from "@/lib/api-football/fixtures";
import { HeroSection } from "@/components/home/HeroSection";
import { LeagueNewsSection } from "@/components/home/LeagueNewsSection";
import { VideosSection } from "@/components/home/VideosSection";
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";
import { LEAGUES } from "@/lib/home/leagues";
import { toHeroSlide, buildLeagueArticles } from "@/lib/home/cards";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:
      locale === "ar"
        ? "MFM Sport - أخبار الكرة المغربية"
        : locale === "fr"
          ? "MFM Sport - Actualites du football marocain"
          : "MFM Sport - Moroccan Football News",
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });
  const tArticle = await getTranslations({ locale, namespace: "article" });

  const today = new Date().toISOString().split("T")[0];
  const todayFixtures = await getFixturesByDate(today);

  // One query feeds both sections: first 5 = hero slider, the rest are split
  // into a distinct chunk per league.
  const latest = await getArticles({ locale: locale as Config["locale"], page: 1, limit: 30 });
  const heroSlides = latest.docs.slice(0, 5).map(toHeroSlide);
  const articlesByLeague = buildLeagueArticles(latest.docs.slice(5), LEAGUES);

  const [thirdHalfVideos, fromStadiumsVideos] = await Promise.all([
    getVideos("the-third-half"),
    getVideos("from-the-stadiums"),
  ]);

  const statusLabels = {
    finished: t("matchStatus.finished"),
    live: t("matchStatus.live"),
    scheduled: t("matchStatus.scheduled"),
  };

  if (heroSlides.length === 0) {
    return (
      <div className="container py-16 text-center">
        <h1 className="text-4xl font-bold text-primary mb-4">MFM Sport</h1>
        <p className="text-muted-foreground">{tArticle("noArticles")}</p>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <h1 className="sr-only">MFM Sport</h1>

      <HeroSection
        slides={heroSlides}
        fixtures={todayFixtures}
        locale={locale}
        statusLabels={statusLabels}
      />

      <LeagueNewsSection
        title={t("byLeague")}
        locale={locale}
        articlesByLeague={articlesByLeague}
      />

      <VideosSection
        title={t("videoThirdHalf")}
        locale={locale}
        videos={thirdHalfVideos}
      />

      <VideosSection
        title={t("videoFromStadiums")}
        locale={locale}
        videos={fromStadiumsVideos}
      />

      <div className="mt-10">
        <NewsletterStrip locale={locale} />
      </div>
    </div>
  );
}
