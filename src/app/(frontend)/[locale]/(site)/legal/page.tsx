import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getPageBySlug } from "@/lib/payload/queries";
import { ArticleBody } from "@/components/articles/ArticleBody";

// Static CMS page — revalidate daily (Payload edits also bust it via /api/revalidate).
export const revalidate = 86400;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: `${t("legal")} | MFM Sport`, alternates: { canonical: `/${locale}/legal` }, };
}

export default async function LegalPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages" });
  const page = await getPageBySlug("legal", locale as Config["locale"]);

  return (
    <div className="container py-8 max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold mb-6">{page?.title || t("legal")}</h1>
        {page?.body ? (
          <ArticleBody content={page.body} />
        ) : (
          <p className="text-muted-foreground">{t("noContent")}</p>
        )}
      </div>
    </div>
  );
}
