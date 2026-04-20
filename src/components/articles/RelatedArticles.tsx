import { ArticleCard } from "./ArticleCard";

type Props = {
  articles: any[];
  locale: string;
  title: string;
};

export function RelatedArticles({ articles, locale, title }: Props) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} locale={locale} />
        ))}
      </div>
    </section>
  );
}
