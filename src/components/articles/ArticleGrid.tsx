import { ArticleCard } from "./ArticleCard";

type Props = {
  articles: any[];
  locale: string;
  columns?: 2 | 3 | 4;
};

export function ArticleGrid({ articles, locale, columns = 3 }: Props) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} locale={locale} />
      ))}
    </div>
  );
}
