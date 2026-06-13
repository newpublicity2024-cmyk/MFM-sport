import type { Config } from "@/payload-types";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAuthorBySlug, getArticlesByAuthor } from "@/lib/payload/queries";
import { AuthorCard } from "@/components/author/AuthorCard";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

/** Shared body for the author base page and its /page/[n] route. */
export async function AuthorListing({
  locale,
  slug,
  page,
}: {
  locale: string;
  slug: string;
  page: number;
}) {
  const loc = locale as Config["locale"];
  const author = await getAuthorBySlug(slug, loc);
  if (!author) notFound();

  const result = await getArticlesByAuthor(author.id, loc, page);
  const t = await getTranslations({ locale, namespace: "author" });

  return (
    <div className="container py-8">
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
          <p className="text-muted-foreground text-center py-12">No articles yet</p>
        )}
      </div>
    </div>
  );
}
