import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import {
  getArticles,
  getArticlesByTag,
  getArticlesByCategory,
  getCompetitions,
  getOurLeagueIds,
  findHomepageSettings,
} from "@/lib/payload/queries";
import { getVideos } from "@/lib/videos";
import { getFixturesByDateForLeagues, getFixturesByLeague } from "@/lib/api-football/fixtures";
import {
  getAllWorldCupFixtures,
  WORLD_CUP_LEAGUE_ID,
  WORLD_CUP_SEASON,
  WORLD_CUP_LOGO,
} from "@/lib/api-football/worldcup";
import type { ApiFixture } from "@/lib/api-football/types";
import { HeroSection } from "@/components/home/HeroSection";
import { LeagueNewsSection } from "@/components/home/LeagueNewsSection";
import { VideosSection } from "@/components/home/VideosSection";
import { HomeMatchesSection } from "@/components/home/HomeMatchesSection";
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { getAds } from "@/lib/payload/ads";
import {
  toHeroSlide,
  toLeagueCard,
  resolveNewsFilters,
  type LeagueCardArticle,
} from "@/lib/home/cards";

// Articles fetched per news-filter tab. The desktop carousel pages through these
// 4 at a time (up to 5 pages of 20); the mobile slider swipes through them all.
const HOME_ARTICLES_PER_TAB = 20;

// Season to query fixtures for a competition: the World Cup pins its own season;
// others use the competition's configured season (falls back to the WC season).
function seasonForCompetition(comp: { apiFootballId?: number | null; season?: number | null }): number {
  if (comp.apiFootballId === WORLD_CUP_LEAGUE_ID) return WORLD_CUP_SEASON;
  return comp.season ?? WORLD_CUP_SEASON;
}

// ISR: render once and serve from the edge cache for 5 min instead of running a
// function on every visit. Live scores still refresh client-side (HomeMatchesSection
// / hero panel poll the cached /api/fixtures endpoints), and Payload edits bust the
// cache via /api/revalidate. Big cut to Function Invocations / Fluid CPU / origin transfer.
export const revalidate = 300;

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
  const localeTyped = locale as Config["locale"];

  const ourLeagueIds = await getOurLeagueIds();
  const homepage = await findHomepageSettings(localeTyped);
  const competitions = await getCompetitions(localeTyped);

  // League carousel mirrors every competition the site has, ordered:
  // Botola (id 200) first, World Cup (id 1) second, everything else after.
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

  // News-by-league filter: admin-configured via Homepage Settings. Each pill is a
  // competition (crest + name) whose tab lists articles carrying the chosen Tag,
  // falling back to the competition's linked category. If the global has no filter
  // yet, fall back to the domestic leagues (Botola first) so the section persists.
  const fallbackRows = competitions.docs
    .filter((c) => c.type === "league")
    .slice()
    .sort((a, b) => (a.apiFootballId === 200 ? -1 : b.apiFootballId === 200 ? 1 : 0))
    .map((competition) => ({ competition }));
  const resolvedFilters = resolveNewsFilters(
    homepage?.newsFilters?.length ? homepage.newsFilters : fallbackRows,
  );
  const newsLeagues = resolvedFilters.map((r) => r.league);

  const articlesByLeagueEntries = await Promise.all(
    resolvedFilters.map(async (r): Promise<[string, LeagueCardArticle[]]> => {
      let docs: unknown[] = [];
      if (r.tagId != null) {
        docs = (await getArticlesByTag(r.tagId, localeTyped, 1, HOME_ARTICLES_PER_TAB)).docs;
      }
      if (docs.length === 0 && r.categoryId != null) {
        docs = (await getArticlesByCategory(r.categoryId, localeTyped, 1, HOME_ARTICLES_PER_TAB)).docs;
      }
      return [r.league.id, docs.map(toLeagueCard)];
    }),
  );
  const articlesByLeague: Record<string, LeagueCardArticle[]> = Object.fromEntries(
    articlesByLeagueEntries,
  );

  // Hero slider uses the latest articles regardless of league.
  const latest = await getArticles({ locale: localeTyped, page: 1, limit: 6 });
  const heroSlides = latest.docs.slice(0, 5).map(toHeroSlide);

  // Match panels: hero = configured competition (all statuses), default World Cup.
  // Lower = a specific competition or today's fixtures across all our leagues.
  const heroComp = homepage?.heroMatches?.competition;
  const lowerComp = homepage?.homeMatches?.competition;
  const [worldCupFixtures, todayFixtures]: [ApiFixture[], ApiFixture[]] = await Promise.all([
    heroComp && typeof heroComp === "object"
      ? getFixturesByLeague(heroComp.apiFootballId, seasonForCompetition(heroComp))
      : getAllWorldCupFixtures(),
    homepage?.homeMatches?.mode === "competition" && lowerComp && typeof lowerComp === "object"
      ? getFixturesByLeague(lowerComp.apiFootballId, seasonForCompetition(lowerComp))
      : getFixturesByDateForLeagues(today, ourLeagueIds),
  ]);

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
          leagues={newsLeagues}
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
