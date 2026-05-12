import Image from "next/image";
import Link from "next/link";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { formatDate, getArticleHeroUrl, getImageAlt } from "@/lib/utils";
import { MatchesPanel } from "@/components/home/MatchesPanel";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = {
  featured: any;
  fixtures: ApiFixture[];
  locale: string;
};

export function HeroSection({ featured, fixtures, locale }: Props) {
  const heroImage = getArticleHeroUrl(featured, "hero");
  const heroAlt = getImageAlt(featured.featuredImage);
  const category = featured.categories?.[0];

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[500px]">
      {/* Main hero — fills grid cell height on desktop */}
      <article className="lg:col-span-2 group relative rounded-2xl overflow-hidden h-56 lg:h-full">
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-scrim/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 start-0 end-0 p-6">
          {category && typeof category === "object" && (
            <div className="relative z-10 mb-2 inline-block">
              <CategoryBadge name={category.name} slug={category.slug} locale={locale} />
            </div>
          )}
          <h2 className="text-[clamp(1.5rem,3vw+1rem,2.25rem)] font-bold text-white leading-tight line-clamp-3">
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

      {/* Matches panel — same height as hero, scrollable */}
      <div className="lg:h-full overflow-y-auto">
        <MatchesPanel fixtures={fixtures} locale={locale} />
      </div>
    </section>
  );
}
