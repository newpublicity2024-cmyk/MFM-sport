import type { Config } from "@/payload-types";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCategoryBySlug, getArticlesByCategory } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

export async function CategoryListing({
  locale,
  slug,
  page,
}: {
  locale: string;
  slug: string;
  page: number;
}) {
  const loc = locale as Config["locale"];
  const category = await getCategoryBySlug(slug, loc);
  if (!category) notFound();

  const [result, t] = await Promise.all([
    getArticlesByCategory(category.id, loc, page),
    getTranslations({ locale, namespace: "category" }),
  ]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-2">{category.name}</h1>
      {category.description && (
        <p className="text-muted-foreground mb-6">{category.description}</p>
      )}

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} withAds />
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
