import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import {
  cachedGetArticleBySlug,
  cachedGetArticleLocalizedSlugs,
  cachedResolveArticleBySlug,
  cachedGetRelatedArticles,
  cachedGetArticles,
  cachedGetAds,
} from "@/lib/payload/cached-queries";
import { decodeSlug } from "@/lib/payload/slug";
import { robotsFor } from "@/lib/seo/indexation";
import {
  formatDate,
  formatTime,
  getArticleHeroUrl,
  getImageUrl,
  getImageAlt,
} from "@/lib/utils";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { InArticleAdInjector } from "@/components/articles/InArticleAdInjector";
import { AdSlot } from "@/components/ads/AdSlot";
import { RelatedArticles } from "@/components/articles/RelatedArticles";
import { Badge } from "@/components/ui/badge";
import { getWorldCupFixtures } from "@/lib/api-football/worldcup";
import { WorldCupCalendar } from "@/components/articles/WorldCupCalendar";
import { SidebarNewsList } from "@/components/articles/SidebarNewsList";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

// IMPORTANT: this route is intentionally DYNAMIC (no `revalidate` / no
// `generateStaticParams`). Article slugs are non-ASCII (Arabic), and on Vercel
// serving such a path through the ISR/SSG layer throws
// `TypeError: Invalid character in header content` on a cache miss — which made
// every newly published Arabic article 500 until the next full redeploy.
// Keeping the page dynamic (the pre-ISR behavior) renders each request live and
// avoids that path. API-Football fetches stay cached via their own
// `next: { revalidate }`, so quota impact is unchanged. See commit 99a3c35.
const HREFLANG: Record<Config["locale"], string> = { ar: "ar-MA", fr: "fr", en: "en" };
const OG_LOCALE: Record<Config["locale"], string> = { ar: "ar_MA", fr: "fr_FR", en: "en_US" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const loc = locale as Config["locale"];

  const [article, localized] = await Promise.all([
    cachedGetArticleBySlug(slug, loc),
    cachedGetArticleLocalizedSlugs(slug, loc),
  ]);
  // notFound() must be raised HERE, in generateMetadata, not just in the page
  // body. generateMetadata resolves before the response starts streaming, so the
  // 404 status can still be set. By the time the page component runs, the
  // [locale]/loading.tsx Suspense boundary has already flushed the shell and the
  // status is locked at 200 — which is why every missing article, category, tag
  // and fixture was answering "200 OK" with a not-found page rendered inside it.
  if (!article) notFound();

  const heroImageUrl = getArticleHeroUrl(article, "hero");
  const category = article.categories?.[0];
  const categoryName = category && typeof category === "object" ? category.name : "";
  const ogImage =
    heroImageUrl ||
    `/api/og?title=${encodeURIComponent(article.title)}&category=${encodeURIComponent(categoryName)}`;

  const decoded = decodeSlug(slug);
  const slugs = localized?.slugs ?? { ar: decoded, fr: decoded, en: decoded };
  const pathFor = (l: Config["locale"]) => `/${l}/articles/${encodeURIComponent(slugs[l])}`;
  const canonical = pathFor(loc);

  const languages: Record<string, string> = {};
  for (const l of ["ar", "fr", "en"] as const) {
    const isTranslated = l === "ar" || slugs[l] !== slugs.ar;
    if (l === loc || isTranslated) languages[HREFLANG[l]] = pathFor(l);
  }
  languages["x-default"] = pathFor("ar");

  const alternateLocale = (["ar", "fr", "en"] as const)
    .filter((l) => l !== loc && (l === "ar" || slugs[l] !== slugs.ar))
    .map((l) => OG_LOCALE[l]);

  return {
    title: `${article.title} | MFM Sport`,
    description: article.excerpt || undefined,
    alternates: { canonical, languages },
    // Archive backfill articles are released into the index in batches rather
    // than all at once — see lib/seo/indexation.ts. Held-back articles are
    // `noindex, follow`, so they still pass authority through their internal
    // links. Native editorial articles are always indexable and get no tag.
    robots: robotsFor(article),
    openGraph: {
      type: "article", url: canonical, siteName: "MFM Sport",
      locale: OG_LOCALE[loc], alternateLocale,
      title: article.title, description: article.excerpt || undefined,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: article.title, description: article.excerpt || undefined, images: [ogImage] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const { article, redirectToSlug } = await cachedResolveArticleBySlug(
    slug,
    locale as Config["locale"],
  );
  if (redirectToSlug) {
    redirect(`/${locale}/articles/${encodeURIComponent(redirectToSlug)}`);
  }
  if (!article) notFound();

  const t = await getTranslations({ locale, namespace: "article" });

  const heroImage = getArticleHeroUrl(article, "hero");
  const heroAlt = getImageAlt(article.featuredImage);

  // Get related articles from same categories
  const categoryIds = (article.categories || [])
    .map((c: any) => (typeof c === "object" ? c.id : c))
    .filter(Boolean);

  const related =
    categoryIds.length > 0
      ? await cachedGetRelatedArticles(
          article.id,
          categoryIds,
          locale as Config["locale"],
          4,
        )
      : null;

  const author = typeof article.author === "object" ? article.author : null;

  const loc = locale as Config["locale"];
  const dir = locale === "ar" ? "rtl" : "ltr";

  const [worldCupFixtures, latestNews, ads] = await Promise.all([
    getWorldCupFixtures(),
    cachedGetArticles({ locale: loc, limit: 13 }),
    cachedGetAds(loc),
  ]);
  // Exclude the article being read; show up to a dozen so the 5-row slider scrolls.
  // Map publishedAt: null → undefined so it satisfies SidebarNewsList's type.
  const sidebarNews = latestNews.docs
    .filter((a) => a.id !== article.id)
    .slice(0, 12)
    .map((a) => ({ ...a, publishedAt: a.publishedAt ?? undefined }));

  const tWorldCup = locale === "ar" ? "مونديال 2026" : locale === "fr" ? "Coupe du monde 2026" : "World Cup 2026";
  const tLatest = locale === "ar" ? "آخر الأخبار" : locale === "fr" ? "Dernières actualités" : "Latest news";

  return (
    <div
      dir="ltr"
      className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:flex lg:items-start lg:gap-6 lg:px-8"
    >
      {/* LEFT rail — 300×600 ad + newsletter. Sticky; lg+ only. */}
      <aside
        dir={dir}
        className="hidden shrink-0 space-y-4 lg:sticky lg:top-24 lg:block lg:w-[260px] xl:w-[300px]"
      >
        {ads["article-sidebar"].length > 0 && (
          <AdCarousel ads={ads["article-sidebar"]} format="tower" />
        )}
        <NewsletterStrip locale={locale} />
      </aside>

      {/* CENTER — the article. */}
      <article dir={dir} className="mx-auto w-full min-w-0 max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:p-8">
        {/* Categories */}
        {article.categories && article.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {article.categories.map((cat: any) =>
              typeof cat === "object" ? (
                <CategoryBadge
                  key={cat.id}
                  name={cat.name}
                  slug={cat.slug}
                  locale={locale}
                />
              ) : null,
            )}
          </div>
        )}

        {/* Title */}
        <h1 className="text-[clamp(1.875rem,4vw+1rem,2.5rem)] font-bold leading-tight mb-4">
          {article.title}
        </h1>

        {/* Author + date row */}
        <div className="flex items-center gap-3 mb-6 text-sm text-muted-foreground">
          {author && (
            <>
              {author.avatar && typeof author.avatar === "object" && (
                <Image
                  src={getImageUrl(author.avatar, "thumbnail") || ""}
                  alt={author.name || ""}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <Link
                href={`/${locale}/author/${author.slug}`}
                className="font-medium text-foreground hover:text-primary transition-colors"
              >
                {author.name}
              </Link>
              <span className="text-border">|</span>
            </>
          )}
          {article.publishedAt && (
            <time dateTime={article.publishedAt}>
              {formatDate(article.publishedAt, locale)} &middot;{" "}
              {formatTime(article.publishedAt, locale)}
            </time>
          )}
        </div>

        {/* Featured image */}
        {heroImage && (
          <div className="relative aspect-video rounded-lg overflow-hidden mb-8">
            <Image
              src={heroImage}
              alt={heroAlt}
              fill
              className="object-cover"
              sizes="(max-width: 896px) 100vw, 896px"
              priority
            />
          </div>
        )}

        {/* Video embed */}
        {article.isVideo && article.videoUrl && (
          <div className="relative aspect-video rounded-lg overflow-hidden mb-8">
            <iframe
              src={article.videoUrl.replace("watch?v=", "embed/")}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={article.title}
            />
          </div>
        )}

        {/* Body */}
        <InArticleAdInjector content={article.body} />

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {t("tags")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag: any) =>
                typeof tag === "object" ? (
                  <Link key={tag.id} href={`/${locale}/tag/${tag.slug}`}>
                    <Badge variant="secondary" className="text-xs">
                      {tag.name}
                    </Badge>
                  </Link>
                ) : null,
              )}
            </div>
          </div>
        )}

        <AdSlot
          slotName="inArticleBottom"
          format="in-article"
          loading="lazy"
          className="my-8"
        />

        {/* Related articles */}
        {related && related.docs.length > 0 && (
          <RelatedArticles
            articles={related.docs}
            locale={locale}
            title={t("relatedNews")}
          />
        )}
        </div>
      </article>

      {/* RIGHT rail — World Cup 2026 calendar + latest news. Sticky; lg+ only. */}
      <aside
        dir={dir}
        className="hidden shrink-0 space-y-4 lg:sticky lg:top-24 lg:block lg:w-[260px] xl:w-[300px]"
      >
        <WorldCupCalendar fixtures={worldCupFixtures} locale={locale} title={tWorldCup} />
        <SidebarNewsList articles={sidebarNews} locale={locale} title={tLatest} />
      </aside>
    </div>
  );
}
