import { LeagueArticleCard } from "./LeagueArticleCard";
import type { LeagueCardArticle } from "@/lib/home/cards";

type Props = {
  articles: LeagueCardArticle[];
  locale: string;
};

// Mobile: one blog at a time, horizontally swipeable, with a peek of the next.
export function ArticleSlider({ articles, locale }: Props) {
  if (articles.length === 0) return null;
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto no-scrollbar">
      {articles.map((article) => (
        <LeagueArticleCard
          key={article.id}
          article={article}
          locale={locale}
          className="w-[85%] shrink-0 snap-start"
        />
      ))}
    </div>
  );
}
