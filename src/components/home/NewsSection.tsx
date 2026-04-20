import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  title: string;
  articles: any[];
  locale: string;
  viewAllHref?: string;
  viewAllText?: string;
  columns?: 2 | 3 | 4;
};

export function NewsSection({
  title,
  articles,
  locale,
  viewAllHref,
  viewAllText,
  columns = 3,
}: Props) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-10">
      <SectionHeader title={title} href={viewAllHref} linkText={viewAllText} />
      <ArticleGrid articles={articles} locale={locale} columns={columns} />
    </section>
  );
}
