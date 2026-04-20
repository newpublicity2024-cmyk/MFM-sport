import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { searchArticles } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";
import { Input } from "@/components/ui/input";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return {
    title: `${t("title")} | MFM Sport`,
  };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q, page } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "search" });
  const query = q?.trim() || "";
  const currentPage = Math.max(1, parseInt(page || "1", 10));

  const result = query
    ? await searchArticles(query, locale, currentPage)
    : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Search form */}
      <form action={`/${locale}/search`} method="GET" className="mb-8">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t("placeholder")}
          className="max-w-lg bg-card"
          autoFocus
        />
      </form>

      {/* Results */}
      {query && result && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {t("results")} &ldquo;{query}&rdquo; &mdash; {result.totalDocs}{" "}
            {result.totalDocs === 1 ? "result" : "results"}
          </p>

          {result.docs.length > 0 ? (
            <>
              <ArticleGrid articles={result.docs} locale={locale} columns={3} />
              <Pagination
                currentPage={result.page!}
                totalPages={result.totalPages}
                basePath={`/${locale}/search?q=${encodeURIComponent(query)}`}
              />
            </>
          ) : (
            <p className="text-muted-foreground text-center py-12">
              {t("noResults")}
            </p>
          )}
        </>
      )}

      {!query && (
        <p className="text-muted-foreground text-center py-12">
          {t("placeholder")}
        </p>
      )}
    </div>
  );
}
