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
import { getFixturesByDateForLeagues } from "@/lib/api-football/fixtures";
import { getCompetitionFixtures } from "@/lib/api-football/competition";
import {
  buildLeagueOrder,
  buildLogoOverrides,
  competitionLogoUrl,
  resolveFeaturedCompetition,
  sortByDisplayOrder,
  toCompetitionRef,
} from "@/lib/home/competitionOrder";
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
    alternates: { canonical: `/${locale}` },
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

  // League carousel mirrors every competition the site has, in the collection's
  // own displayOrder — so promoting the league currently in season is an edit,
  // not a deploy. Same ordering and crest rules as the news-filter pills.
  const carouselLeagues = sortByDisplayOrder(competitions.docs).map((c) => ({
    slug: c.slug,
    name: c.name,
    logoUrl: competitionLogoUrl(c.apiFootballId, c.logoUrl),
  }));

  // News-by-league filter: admin-configured via Homepage Settings. Each pill is a
  // competition (crest + name) whose tab lists articles carrying the chosen Tag,
  // falling back to the competition's linked category. If the global has no filter
  // yet, fall back to every league-type competition in display order so the
  // section persists.
  const fallbackRows = sortByDisplayOrder(
    competitions.docs.filter((c) => c.type === "league"),
  ).map((competition) => ({ competition }));
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

  // Match panels: hero = the configured competition's current season across all
  // statuses, falling back to the default competition. Lower = a specific
  // competition or today's fixtures across all our leagues. Seasons are resolved
  // from API-Football's `current` flag, so neither pins a year.
  const heroCompetition = resolveFeaturedCompetition(
    homepage?.heroMatches?.competition,
    competitions.docs,
  );
  const lowerCompetition =
    homepage?.homeMatches?.mode === "competition"
      ? toCompetitionRef(homepage?.homeMatches?.competition)
      : null;
  const [heroFixtures, todayFixtures]: [ApiFixture[], ApiFixture[]] = await Promise.all([
    heroCompetition ? getCompetitionFixtures(heroCompetition) : Promise.resolve([]),
    lowerCompetition
      ? getCompetitionFixtures(lowerCompetition)
      : getFixturesByDateForLeagues(today, ourLeagueIds),
  ]);

  // Upstream fixture data carries API-Football's own crests and no ordering, so
  // hand the panel the CMS's view of both, keyed by league id.
  const logoOverrides = buildLogoOverrides(competitions.docs);
  const leagueOrder = buildLeagueOrder(competitions.docs);

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
          fixtures={heroFixtures}
          locale={locale}
          leaguesLabel={t("leaguesNav")}
          leagues={carouselLeagues}
          statusLabels={statusLabels}
          openLeagueId={heroCompetition?.apiFootballId}
          logoOverrides={logoOverrides}
          leagueOrder={leagueOrder}
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
