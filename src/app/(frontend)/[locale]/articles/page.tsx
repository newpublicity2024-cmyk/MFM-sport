import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticles } from "@/lib/payload/queries";
import { getAds } from "@/lib/payload/ads";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "article" });
  return {
    title: `${t("allArticles")} | MFM Sport`,
  };
}

export default async function ArticlesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const result = await getArticles({ locale: locale as Config["locale"], page: currentPage, limit: 12 });
  const ads = await getAds(locale as Config["locale"]);
  const t = await getTranslations({ locale, namespace: "article" });

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">{t("allArticles")}</h1>

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} withAds adCards={ads["news-card"]} />
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
