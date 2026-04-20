import Image from "next/image";
import Link from "next/link";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { formatDate, getImageUrl, getImageAlt } from "@/lib/utils";

type Props = {
  article: {
    title: string;
    slug: string;
    featuredImage?: any;
    categories?: any[];
    publishedAt?: string;
    isVideo?: boolean;
  };
  locale: string;
  size?: "default" | "large";
};

export function ArticleCard({ article, locale, size = "default" }: Props) {
  const imageUrl = getImageUrl(
    article.featuredImage,
    size === "large" ? "hero" : "card",
  );
  const imageAlt = getImageAlt(article.featuredImage);
  const category = article.categories?.[0];

  return (
    <Link
      href={`/${locale}/articles/${article.slug}`}
      className="group block"
    >
      <article className="overflow-hidden rounded-lg bg-card border border-border transition-colors hover:border-primary/30">
        {/* Image */}
        <div className="relative aspect-video overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes={size === "large" ? "100vw" : "(max-width: 768px) 100vw, 33vw"}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-secondary">
              <span className="text-muted-foreground text-sm">MFM Sport</span>
            </div>
          )}
          {/* Category badge overlay */}
          {category && typeof category === "object" && (
            <div className="absolute bottom-2 start-2" onClick={(e) => e.preventDefault()}>
              <CategoryBadge
                name={category.name}
                slug={category.slug}
                locale={locale}
              />
            </div>
          )}
          {/* Video indicator */}
          {article.isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <h3
            className={`font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors ${
              size === "large" ? "text-lg" : "text-sm"
            }`}
          >
            {article.title}
          </h3>
          {article.publishedAt && (
            <time className="mt-1 block text-xs text-muted-foreground">
              {formatDate(article.publishedAt, locale)}
            </time>
          )}
        </div>
      </article>
    </Link>
  );
}
