import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import {
  getArticles,
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
} from "@/lib/home/competitionOrder";
import { resolveLatestNewsTags } from "@/lib/home/latestNewsTags";
import { getTopTags } from "@/lib/home/tagUsage";
import type { ApiFixture } from "@/lib/api-football/types";
import { HeroSection } from "@/components/home/HeroSection";
import { LatestNewsSection } from "@/components/home/LatestNewsSection";
import { VideosSection } from "@/components/home/VideosSection";
import { HomeMatchesSection } from "@/components/home/HomeMatchesSection";
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { getAds } from "@/lib/payload/ads";
import { toHeroSlide, toLeagueCard } from "@/lib/home/cards";

// Articles in the latest-news list. The desktop carousel pages through these
// 4 at a time; the mobile slider swipes through them all. A chip's list is
// the same size, fetched on demand (app/api/home/latest-news).
const HOME_ARTICLES_PER_LIST = 12;

// Tag chips on the latest-news row: the site's most-used tags, this many. The
// row slides, so the count is a weight budget (≈ 100 bytes per chip), not a
// layout limit.
const HOME_TAG_CHIP_LIMIT = 80;

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

  const [t, tArticle, tMatch, tComp] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "article" }),
    getTranslations({ locale, namespace: "match" }),
    getTranslations({ locale, namespace: "competition" }),
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
  const orderedCompetitions = sortByDisplayOrder(competitions.docs);
  const carouselLeagues = orderedCompetitions.map((c) => ({
    slug: c.slug,
    name: c.name,
    logoUrl: competitionLogoUrl(c.apiFootballId, c.logoUrl),
  }));
  // League chips of the lower matches section: same order and crests.
  const leagueChips = orderedCompetitions.map((c) => ({
    id: String(c.apiFootballId),
    name: c.name,
    logoUrl: competitionLogoUrl(c.apiFootballId, c.logoUrl),
  }));

  // Latest news: the unfiltered newest articles now, a chip's list on demand.
  // Chips are the admin's (Homepage Settings), else the site's most-used tags,
  // else — should that aggregate fail — the tags the latest articles carry.
  const topTags = await getTopTags(localeTyped, HOME_TAG_CHIP_LIMIT).catch((error) => {
    console.error("[home] getTopTags failed, deriving chips from the latest articles:", error);
    return [];
  });
  const newsTags = resolveLatestNewsTags(homepage?.latestNewsTags, latest.docs, topTags);
  const latestCards = latest.docs.map(toLeagueCard);

  // Hero slider uses the latest articles regardless of tag.
  const heroSlides = latest.docs.slice(0, 5).map(toHeroSlide);

  // Hero matches panel: every league the admin listed (default: the site's
  // default competition), one collapsible group each with the first open.
  // Seasons are resolved from API-Football's `current` flag, so nothing pins a
  // year.
  const heroCompetitions = resolveHeroCompetitions(
    homepage?.heroMatches?.leagues,
    competitions.docs,
  );
  // A competition's list is its whole season; the hero panel gets a window of
  // it (live + recent results + nearest upcoming), not all 240 rows — see
  // lib/api-football/fixtureWindow. The lower section is today's games across
  // every league the site lists; its calendar loads other days on demand.
  const [heroSeasons, todayFixtures]: [ApiFixture[][], ApiFixture[]] = await Promise.all([
    Promise.all(heroCompetitions.map((c) => getCompetitionFixtures(c))),
    getFixturesByDateForLeagues(today, ourLeagueIds),
  ]);
  const heroFixtures = heroSeasons.flatMap((season) =>
    windowFixtures(season, HOME_FIXTURE_WINDOW),
  );

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
          latest={latestCards}
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
          today={today}
          leagues={leagueChips}
          labels={{
            ...matchLabels,
            allLeagues: tComp("allCompetitions"),
            leagueFilters: t("leagueFilters"),
            dateLabel: t("dateLabel"),
            days: t("days"),
          }}
        />

        <NewsletterStrip locale={locale} />
      </div>
    </div>
  );
}
