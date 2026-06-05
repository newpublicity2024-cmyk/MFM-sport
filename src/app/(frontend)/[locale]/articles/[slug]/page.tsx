import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import {
  getArticleBySlug,
  getArticleLocalizedSlugs,
  resolveArticleBySlug,
  getRelatedArticles,
} from "@/lib/payload/queries";
import { decodeSlug } from "@/lib/payload/slug";
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

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

const HREFLANG: Record<Config["locale"], string> = { ar: "ar-MA", fr: "fr", en: "en" };
const OG_LOCALE: Record<Config["locale"], string> = { ar: "ar_MA", fr: "fr_FR", en: "en_US" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const loc = locale as Config["locale"];

  const [article, localized] = await Promise.all([
    getArticleBySlug(slug, loc),
    getArticleLocalizedSlugs(slug, loc),
  ]);
  if (!article) return { title: "Not Found" };

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

  const { article, redirectToSlug } = await resolveArticleBySlug(
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
      ? await getRelatedArticles(
          article.id,
          categoryIds,
          locale as Config["locale"],
          4,
        )
      : null;

  const author = typeof article.author === "object" ? article.author : null;

  return (
    <article className="container py-8 max-w-4xl">
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
  );
}
