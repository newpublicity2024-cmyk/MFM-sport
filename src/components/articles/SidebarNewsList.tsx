import Image from "next/image";
import Link from "next/link";
import { formatDate, getArticleHeroUrl, getImageAlt } from "@/lib/utils";

type SidebarArticle = {
  id: number | string;
  title: string;
  slug: string;
  featuredImage?: unknown;
  publishedAt?: string;
};

type Props = {
  articles: SidebarArticle[];
  locale: string;
  title: string;
};

// Right-rail latest-news list: a titled card whose body is a vertical scroll
// slider of compact rows (small thumbnail + 2-line title), ~5 visible. Each row
// is shrink-0 so flex-col never crushes it. The cap persists on desktop (this
// rail is desktop-only and is meant to stay a scrollable window).
export function SidebarNewsList({ articles, locale, title }: Props) {
  if (articles.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <h2 className="mb-2 px-1 text-sm font-bold">{title}</h2>
      <div
        data-sidebar-news-slider
        className="flex flex-col gap-2 overflow-y-auto no-scrollbar snap-y snap-mandatory max-h-[22rem]"
      >
        {articles.map((a) => {
          const imageUrl = getArticleHeroUrl(a, "card");
          return (
            <Link
              key={a.id}
              href={`/${locale}/articles/${a.slug}`}
              className="group flex shrink-0 snap-start gap-2 rounded-lg border border-border bg-background p-2 transition-colors hover:border-primary/30"
            >
              <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-secondary">
                {imageUrl && (
                  <Image
                    src={imageUrl}
                    alt={getImageAlt(a.featuredImage)}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-xs font-semibold leading-tight transition-colors group-hover:text-primary">
                  {a.title}
                </h3>
                {a.publishedAt && (
                  <time
                    dateTime={a.publishedAt}
                    className="mt-1 block text-[10px] text-muted-foreground"
                  >
                    {formatDate(a.publishedAt, locale)}
                  </time>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
