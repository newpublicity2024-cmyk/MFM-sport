import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticles, getCompetitions } from "@/lib/payload/queries";
import { getVideos } from "@/lib/videos";
import { getFixturesByDate } from "@/lib/api-football/fixtures";
import {
  getAllWorldCupFixtures,
  WORLD_CUP_LEAGUE_ID,
  WORLD_CUP_LOGO,
} from "@/lib/api-football/worldcup";
import { HeroSection } from "@/components/home/HeroSection";
import { LeagueNewsSection } from "@/components/home/LeagueNewsSection";
import { VideosSection } from "@/components/home/VideosSection";
import { HomeMatchesSection } from "@/components/home/HomeMatchesSection";
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { getAds } from "@/lib/payload/ads";
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
  const tMatch = await getTranslations({ locale, namespace: "match" });
  const matchLabels = {
    liveNow: tMatch("liveNow"),
    events: tMatch("events"),
    venue: t("venue"),
    referee: t("referee"),
    viewFullMatch: t("viewFullMatch"),
    loadingDetails: t("loadingDetails"),
    noEvents: t("noEvents"),
  };

  const today = new Date().toISOString().split("T")[0];
  // Lower matches section: today's fixtures across all the site's leagues.
  // Hero matches panel: World Cup 2026 only (all statuses).
  const [todayFixtures, worldCupFixtures] = await Promise.all([
    getFixturesByDate(today),
    getAllWorldCupFixtures(),
  ]);

  // League carousel mirrors every competition the site has, ordered:
  // Botola (id 200) first, World Cup (id 1) second, everything else after.
  const competitions = await getCompetitions(locale as Config["locale"]);
  const carouselRank = (apiFootballId?: number | null) =>
    apiFootballId === 200 ? 0 : apiFootballId === WORLD_CUP_LEAGUE_ID ? 1 : 2;
  const carouselLeagues = competitions.docs
    .slice()
    .sort((a, b) => carouselRank(a.apiFootballId) - carouselRank(b.apiFootballId))
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      logoUrl:
        c.apiFootballId === WORLD_CUP_LEAGUE_ID
          ? WORLD_CUP_LOGO
          : c.logoUrl || `https://media.api-sports.io/football/leagues/${c.apiFootballId}.png`,
    }));

  // One query feeds both sections: first 5 = hero slider, the rest are split
  // into a distinct chunk per league.
  const latest = await getArticles({ locale: locale as Config["locale"], page: 1, limit: 30 });
  const heroSlides = latest.docs.slice(0, 5).map(toHeroSlide);
  const articlesByLeague = buildLeagueArticles(latest.docs.slice(5), LEAGUES);

  const ads = await getAds(locale as Config["locale"]);

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
    // No top padding: the OCP banner is intentionally flush under the header so the
    // page drops down by exactly the banner's height.
    <div className="space-y-6 pb-6">
      <h1 className="sr-only">MFM Sport</h1>

      {/* Top ad — full section width, above the hero + leagues carousel. */}
      <div className="container">
        <AdCarousel ads={ads["top-banner"]} format="banner" />
      </div>

      <div className="container space-y-6">
        <HeroSection
          slides={heroSlides}
          fixtures={worldCupFixtures}
          locale={locale}
          leaguesLabel={t("leaguesNav")}
          leagues={carouselLeagues}
          statusLabels={statusLabels}
        />
      </div>

      {/* Between hero and latest news. */}
      <div className="container">
        <AdCarousel ads={ads["hero-news"]} format="banner" />
      </div>

      <div className="container space-y-6">
        <LeagueNewsSection
          title={t("byLeague")}
          locale={locale}
          articlesByLeague={articlesByLeague}
          ads={ads["news-card"]}
        />
      </div>

      {/* Between latest news and the first YouTube section. */}
      <div className="container">
        <AdCarousel ads={ads["news-videos"]} format="banner" />
      </div>

      <div className="container space-y-6">
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
      </div>

      {/* Between the second YouTube section and the matches section. */}
      <div className="container">
        <AdCarousel ads={ads["videos-matches"]} format="banner" />
      </div>

      <div className="container space-y-6">
        <HomeMatchesSection
          title={t("matchesTitle")}
          emptyLabel={t("matchesEmpty")}
          locale={locale}
          fixtures={todayFixtures}
          labels={matchLabels}
        />

        <NewsletterStrip locale={locale} />
      </div>
    </div>
  );
}
