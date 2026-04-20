import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getCategoryBySlug, getArticlesByCategory } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategoryBySlug(slug, locale);
  if (!category) return { title: "Not Found" };
  return {
    title: `${category.name} | MFM Sport`,
    description: category.description || undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const category = await getCategoryBySlug(slug, locale);
  if (!category) notFound();

  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const result = await getArticlesByCategory(category.id, locale, currentPage);
  const t = await getTranslations({ locale, namespace: "category" });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">{category.name}</h1>
      {category.description && (
        <p className="text-muted-foreground mb-6">{category.description}</p>
      )}

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} />
          <Pagination
            currentPage={result.page!}
            totalPages={result.totalPages}
            basePath={`/${locale}/category/${slug}`}
          />
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">
          {t("allIn")} {category.name}
        </p>
      )}
    </div>
  );
}
