import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getTagBySlug, getArticlesByTag } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tag = await getTagBySlug(slug, locale);
  if (!tag) return { title: "Not Found" };
  return {
    title: `${tag.name} | MFM Sport`,
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const tag = await getTagBySlug(slug, locale);
  if (!tag) notFound();

  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const result = await getArticlesByTag(tag.id, locale, currentPage);
  const t = await getTranslations({ locale, namespace: "article" });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-muted-foreground">#</span>
        <h1 className="text-2xl font-bold">{tag.name}</h1>
      </div>

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} />
          <Pagination
            currentPage={result.page!}
            totalPages={result.totalPages}
            basePath={`/${locale}/tag/${slug}`}
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
