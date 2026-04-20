import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getPageBySlug } from "@/lib/payload/queries";
import { ArticleBody } from "@/components/articles/ArticleBody";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: `${t("legal")} | MFM Sport` };
}

export default async function LegalPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages" });
  const page = await getPageBySlug("legal", locale);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{page?.title || t("legal")}</h1>
      {page?.body ? (
        <ArticleBody content={page.body} />
      ) : (
        <p className="text-muted-foreground">{t("noContent")}</p>
      )}
    </div>
  );
}
