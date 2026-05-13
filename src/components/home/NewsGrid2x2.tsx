import Image from "next/image";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { MockLeagueArticle, MockLocaleString } from "@/lib/home/mockLeagueNews";

type Props = {
  articles: MockLeagueArticle[];
  locale: string;
};

function pickLocalized(s: MockLocaleString, locale: string): string {
  if (locale === "ar") return s.ar;
  if (locale === "fr") return s.fr;
  return s.en;
}

export function NewsGrid2x2({ articles, locale }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {articles.map((article) => (
        <article
          key={article.id}
          className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30"
        >
          <div className="relative aspect-video overflow-hidden">
            <Image
              src={article.imageUrl}
              alt={pickLocalized(article.title, locale)}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 1024px) 100vw, 33vw"
            />
            <div className="absolute bottom-2 start-2 z-10 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
              {pickLocalized(article.category, locale)}
            </div>
          </div>
          <div className="flex flex-1 flex-col p-3">
            <h3 className="text-sm font-semibold leading-tight line-clamp-2 transition-colors group-hover:text-primary">
              <Link
                href={`/${locale}/articles/${article.slug}`}
                className="after:absolute after:inset-0 after:content-['']"
              >
                {pickLocalized(article.title, locale)}
              </Link>
            </h3>
            <time
              dateTime={article.publishedAt}
              className="mt-auto pt-2 text-xs text-muted-foreground"
            >
              {formatDate(article.publishedAt, locale)}
            </time>
          </div>
        </article>
      ))}
    </div>
  );
}
