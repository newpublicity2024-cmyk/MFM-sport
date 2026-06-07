import { cn } from "@/lib/utils";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { LeagueArticleCard } from "./LeagueArticleCard";
import type { AdItem } from "@/lib/payload/ads";
import type { LeagueCardArticle } from "@/lib/home/cards";

type Props = {
  articles: LeagueCardArticle[];
  locale: string;
  className?: string;
  ads?: AdItem[];
};

export function NewsGrid2x2({ articles, locale, className, ads = [] }: Props) {
  const hasAd = ads.length > 0;
  const shownArticles = hasAd ? articles.slice(0, 3) : articles.slice(0, 4);
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)}>
      {shownArticles.map((article) => (
        <LeagueArticleCard key={article.id} article={article} locale={locale} />
      ))}
      {hasAd && <AdCarousel ads={ads} format="card" />}
    </div>
  );
}
