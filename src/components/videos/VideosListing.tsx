import type { Config } from "@/payload-types";
import { getTranslations } from "next-intl/server";
import { getVideoArticles } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

/** Shared body for the videos base page and its /page/[n] route. */
export async function VideosListing({
  locale,
  page,
}: {
  locale: string;
  page: number;
}) {
  const t = await getTranslations({ locale, namespace: "videos" });
  const result = await getVideoArticles(locale as Config["locale"], page);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} />
          <Pagination
            currentPage={result.page!}
            totalPages={result.totalPages}
            basePath={`/${locale}/videos`}
          />
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">{t("noVideos")}</p>
      )}
    </div>
  );
}
