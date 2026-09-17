import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import {
  getArticles,
  getArticlesByTag,
  getCompetitions,
  getOurLeagueIds,
  findHomepageSettings,
} from "@/lib/payload/queries";
import { getVideos } from "@/lib/videos";
import { getFixturesByDateForLeagues } from "@/lib/api-football/fixtures";
import { getCompetitionFixtures } from "@/lib/api-football/competition";
import { windowFixtures } from "@/lib/api-football/fixtureWindow";
import {
  buildLogoOverrides,
  buildPinnedLeagueOrder,
  competitionLogoUrl,
  resolveHeroCompetitions,
  sortByDisplayOrder,
  toCompetitionRef,
} from "@/lib/home/competitionOrder";
import { LATEST_KEY, resolveLatestNewsTags } from "@/lib/home/latestNewsTags";
import type { ApiFixture } from "@/lib/api-football/types";
import { HeroSection } from "@/components/home/HeroSection";
import { LatestNewsSection } from "@/components/home/LatestNewsSection";
import { VideosSection } from "@/components/home/VideosSection";
import { HomeMatchesSection } from "@/components/home/HomeMatchesSection";
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { getAds } from "@/lib/payload/ads";
import { toHeroSlide, toLeagueCard, type LeagueCardArticle } from "@/lib/home/cards";

// Articles per latest-news list (the unfiltered one and one per tag chip). The
// desktop carousel pages through these 4 at a time; the mobile slider swipes
// through them all. Every list ships in the page, so this bounds its weight.
const HOME_ARTICLES_PER_LIST = 12;

// ISR: render once and serve from the edge cache for 5 min instead of running a
// function on every visit. Live scores still refresh client-side (HomeMatchesSection
// / hero panel poll the cached /api/fixtures endpoints), and Payload edits bust the
// cache via /api/revalidate. Big cut to Function Invocations / Fluid CPU / origin transfer.
/** Live + this many recent results + this many upcoming, per competition panel. */
const HOME_FIXTURE_WINDOW = { last: 12, next: 12 } as const;

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

  const [t, tArticle, tMatch] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "article" }),
    getTranslations({ locale, namespace: "match" }),
  ]);
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

  // Independent reads, so one round rather than three; this render only runs
  // on ISR regeneration, but a publish or the video cron triggers one and the
  // next visitor waits for it.
  const [ourLeagueIds, homepage, competitions, latest] = await Promise.all([
    getOurLeagueIds(),
    findHomepageSettings(localeTyped),
    getCompetitions(localeTyped),
    getArticles({ locale: localeTyped, page: 1, limit: HOME_ARTICLES_PER_LIST }),
  ]);

  // League carousel mirrors every competition the site has, in the collection's
  // own displayOrder — so promoting the league currently in season is an edit,
  // not a deploy. Same ordering and crest rules as the hero panel's groups.
  const carouselLeagues = sortByDisplayOrder(competitions.docs).map((c) => ({
    slug: c.slug,
    name: c.name,
    logoUrl: competitionLogoUrl(c.apiFootballId, c.logoUrl),
  }));

  // Latest news: the unfiltered newest articles, plus one list per tag chip.
  // Chips are the admin's (Homepage Settings), else the tags the latest
  // articles carry. Each chip's list is fetched here so switching a chip is
  // instant and the section works without a client round trip.
  const newsTags = resolveLatestNewsTags(homepage?.latestNewsTags, latest.docs);
  const articlesByTagEntries = await Promise.all(
    newsTags.map(async (tag): Promise<[string, LeagueCardArticle[]]> => {
      const res = await getArticlesByTag(tag.id, localeTyped, 1, HOME_ARTICLES_PER_LIST);
      return [tag.id, res.docs.map(toLeagueCard)];
    }),
  );
  const articlesByTag: Record<string, LeagueCardArticle[]> = {
    [LATEST_KEY]: latest.docs.map(toLeagueCard),
    ...Object.fromEntries(articlesByTagEntries),
  };

  // Hero slider uses the latest articles regardless of tag.
  const heroSlides = latest.docs.slice(0, 5).map(toHeroSlide);

  // Match panels: hero = every league the admin listed (default: the site's
  // default competition), one collapsible group each with the first open.
  // Lower = a specific competition or today's fixtures across all our leagues.
  // Seasons are resolved from API-Football's `current` flag, so nothing pins a
  // year.
  const heroCompetitions = resolveHeroCompetitions(
    homepage?.heroMatches?.leagues,
    competitions.docs,
  );
  const lowerCompetition =
    homepage?.homeMatches?.mode === "competition"
      ? toCompetitionRef(homepage?.homeMatches?.competition)
      : null;
  // A competition's list is its whole season; the panels get a window of it
  // (live + recent results + nearest upcoming), not all 240 rows — see
  // lib/api-football/fixtureWindow. Today's-date mode is small by nature.
  const [heroSeasons, lowerFixtures]: [ApiFixture[][], ApiFixture[]] = await Promise.all([
    Promise.all(heroCompetitions.map((c) => getCompetitionFixtures(c))),
    lowerCompetition
      ? getCompetitionFixtures(lowerCompetition)
      : getFixturesByDateForLeagues(today, ourLeagueIds),
  ]);
  const heroFixtures = heroSeasons.flatMap((season) =>
    windowFixtures(season, HOME_FIXTURE_WINDOW),
  );
  const todayFixtures = lowerCompetition
    ? windowFixtures(lowerFixtures, HOME_FIXTURE_WINDOW)
    : lowerFixtures;

  // Upstream fixture data carries API-Football's own crests and no ordering, so
  // hand the panel the CMS's view of both, keyed by league id.
  const logoOverrides = buildLogoOverrides(competitions.docs);
  // The hero panel lists its groups in the admin's order (the chosen leagues
  // first, then everything else by displayOrder).
  const heroLeagueOrder = buildPinnedLeagueOrder(heroCompetitions, competitions.docs);

  const [ads, channelVideos] = await Promise.all([
    getAds(locale as Config["locale"]),
    getVideos("channel-uploads"),
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
          openLeagueId={heroCompetitions[0]?.apiFootballId}
          logoOverrides={logoOverrides}
          leagueOrder={heroLeagueOrder}
        />
      </div>

      {/* Between hero and latest news. */}
      <div className="container">
        <AdCarousel ads={ads["hero-news"]} format="banner" />
      </div>

      <div className="container space-y-6">
        <LatestNewsSection
          title={t("latestNews")}
          locale={locale}
          tags={newsTags}
          articlesByTag={articlesByTag}
          labels={{
            all: t("allNews"),
            tagFilters: t("tagFilters"),
            empty: tArticle("noArticles"),
          }}
          ads={ads["news-card"]}
        />
      </div>

      {/* Between latest news and the YouTube section. */}
      <div className="container">
        <AdCarousel ads={ads["news-videos"]} format="banner" />
      </div>

      {/* One section: the channel's latest uploads (see lib/youtube). */}
      <div className="container space-y-6">
        <VideosSection title={t("latestVideos")} locale={locale} videos={channelVideos} />
      </div>

      {/* Between the YouTube section and the matches section. */}
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
