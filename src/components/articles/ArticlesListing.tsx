import type { Config } from "@/payload-types";
import { getTranslations } from "next-intl/server";
import { getArticles } from "@/lib/payload/queries";
import { getAds } from "@/lib/payload/ads";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

export async function ArticlesListing({
  locale,
  page,
}: {
  locale: string;
  page: number;
}) {
  const loc = locale as Config["locale"];
  const [result, ads, t] = await Promise.all([
    getArticles({ locale: loc, page, limit: 12 }),
    getAds(loc),
    getTranslations({ locale, namespace: "article" }),
  ]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">{t("allArticles")}</h1>

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid
            articles={result.docs}
            locale={locale}
            columns={3}
            withAds
            adCards={ads["news-card"]}
          />
          <Pagination
            currentPage={result.page!}
            totalPages={result.totalPages}
            basePath={`/${locale}/articles`}
          />
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">
          {t("noArticles")}
        </p>
      )}
    </div>
  );
}
