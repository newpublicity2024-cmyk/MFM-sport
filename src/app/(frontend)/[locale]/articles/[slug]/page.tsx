import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticleBySlug, getRelatedArticles } from "@/lib/payload/queries";
import { formatDate, formatTime, getArticleHeroUrl, getImageUrl, getImageAlt } from "@/lib/utils";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { InArticleAdInjector } from "@/components/articles/InArticleAdInjector";
import { AdSlot } from "@/components/ads/AdSlot";
import { RelatedArticles } from "@/components/articles/RelatedArticles";
import { Badge } from "@/components/ui/badge";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getArticleBySlug(slug, locale as Config["locale"]);
  if (!article) return { title: "Not Found" };

  const heroImageUrl = getArticleHeroUrl(article, "hero");
  const category = article.categories?.[0];
  const categoryName = category && typeof category === "object" ? category.name : "";

  const ogImage = heroImageUrl
    || `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/og?title=${encodeURIComponent(article.title)}&category=${encodeURIComponent(categoryName)}`;

  return {
    title: `${article.title} | MFM Sport`,
    description: article.excerpt || undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt || undefined,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const article = await getArticleBySlug(slug, locale as Config["locale"]);
  if (!article) notFound();

  const t = await getTranslations({ locale, namespace: "article" });

  const heroImage = getArticleHeroUrl(article, "hero");
  const heroAlt = getImageAlt(article.featuredImage);

  // Get related articles from same categories
  const categoryIds = (article.categories || [])
    .map((c: any) => (typeof c === "object" ? c.id : c))
    .filter(Boolean);

  const related = categoryIds.length > 0
    ? await getRelatedArticles(article.id, categoryIds, locale as Config["locale"], 4)
    : null;

  const author = typeof article.author === "object" ? article.author : null;

  return (
    <article className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Categories */}
      {article.categories && article.categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {article.categories.map((cat: any) =>
            typeof cat === "object" ? (
              <CategoryBadge key={cat.id} name={cat.name} slug={cat.slug} locale={locale} />
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

      <AdSlot slotName="inArticleBottom" format="in-article" loading="lazy" className="my-8" />

      {/* Related articles */}
      {related && related.docs.length > 0 && (
        <RelatedArticles
          articles={related.docs}
          locale={locale}
          title={t("relatedNews")}
        />
      )}
    </article>
  );
}
