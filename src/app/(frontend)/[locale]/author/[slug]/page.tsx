import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getAuthorBySlug, getArticlesByAuthor } from "@/lib/payload/queries";
import { AuthorCard } from "@/components/author/AuthorCard";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const author = await getAuthorBySlug(slug, locale);
  if (!author) return { title: "Not Found" };
  return {
    title: `${author.name} | MFM Sport`,
    description: author.bio || undefined,
  };
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const author = await getAuthorBySlug(slug, locale);
  if (!author) notFound();

  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const result = await getArticlesByAuthor(author.id, locale, currentPage);
  const t = await getTranslations({ locale, namespace: "author" });

  return (
    <div className="container mx-auto px-4 py-8">
      <AuthorCard author={author} locale={locale} />

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">{t("articles")}</h2>

        {result.docs.length > 0 ? (
          <>
            <ArticleGrid articles={result.docs} locale={locale} columns={3} />
            <Pagination
              currentPage={result.page!}
              totalPages={result.totalPages}
              basePath={`/${locale}/author/${slug}`}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-center py-12">
            No articles yet
          </p>
        )}
      </div>
    </div>
  );
}
