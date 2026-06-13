import type { Config } from "@/payload-types";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getTagBySlug, getArticlesByTag } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

/** Shared body for the tag base page and its /page/[n] route. */
export async function TagListing({
  locale,
  slug,
  page,
}: {
  locale: string;
  slug: string;
  page: number;
}) {
  const loc = locale as Config["locale"];
  const tag = await getTagBySlug(slug, loc);
  if (!tag) notFound();

  const result = await getArticlesByTag(tag.id, loc, page);
  const t = await getTranslations({ locale, namespace: "article" });

  return (
    <div className="container py-8">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-muted-foreground">#</span>
        <h1 className="text-2xl font-bold">{tag.name}</h1>
      </div>

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} withAds />
          <Pagination
            currentPage={result.page!}
            totalPages={result.totalPages}
            basePath={`/${locale}/tag/${slug}`}
          />
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">{t("noArticles")}</p>
      )}
    </div>
  );
}
