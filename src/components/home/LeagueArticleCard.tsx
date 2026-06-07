import Image from "next/image";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import type { LeagueCardArticle } from "@/lib/home/cards";

type Props = {
  article: LeagueCardArticle;
  locale: string;
  className?: string;
};

export function LeagueArticleCard({ article, locale, className }: Props) {
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-primary/30",
        className,
      )}
    >
      <div className="relative aspect-video overflow-hidden">
        {article.heroUrl ? (
          <Image
            src={article.heroUrl}
            alt={article.title}
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-secondary">
            <span className="text-xs text-muted-foreground">MFM Sport</span>
          </div>
        )}
        {article.categoryName && (
          <div className="absolute bottom-2 start-2 z-10 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            {article.categoryName}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2 transition-colors group-hover:text-primary">
          <Link
            href={`/${locale}/articles/${article.slug}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {article.title}
          </Link>
        </h3>
        {article.publishedAt && (
          <time
            dateTime={article.publishedAt}
            className="mt-auto pt-2 text-xs text-muted-foreground"
          >
            {formatDate(article.publishedAt, locale)}
          </time>
        )}
      </div>
    </article>
  );
}
