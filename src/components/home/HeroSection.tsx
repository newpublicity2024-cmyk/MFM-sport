import Image from "next/image";
import Link from "next/link";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { formatDate, getArticleHeroUrl, getImageAlt } from "@/lib/utils";
import { ArticleCard } from "@/components/articles/ArticleCard";

type Props = {
  featured: any;
  secondary: any[];
  locale: string;
};

export function HeroSection({ featured, secondary, locale }: Props) {
  const heroImage = getArticleHeroUrl(featured, "hero");
  const heroAlt = getImageAlt(featured.featuredImage);
  const category = featured.categories?.[0];

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main hero */}
      <article className="lg:col-span-2 group relative aspect-video rounded-lg overflow-hidden">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={heroAlt}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 66vw"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary">
            <span className="text-muted-foreground">MFM Sport</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 start-0 end-0 p-6">
          {category && typeof category === "object" && (
            <div className="relative z-10 mb-2 inline-block">
              <CategoryBadge name={category.name} slug={category.slug} locale={locale} />
            </div>
          )}
          <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight line-clamp-3">
            <Link
              href={`/${locale}/articles/${featured.slug}`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {featured.title}
            </Link>
          </h2>
          {featured.publishedAt && (
            <time dateTime={featured.publishedAt} className="mt-2 block text-sm text-white/70">
              {formatDate(featured.publishedAt, locale)}
            </time>
          )}
        </div>
      </article>

      {/* Secondary stories */}
      <div className="flex flex-col gap-4">
        {secondary.slice(0, 3).map((article: any) => (
          <ArticleCard key={article.id} article={article} locale={locale} />
        ))}
      </div>
    </section>
  );
}
