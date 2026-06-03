import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getPageBySlug } from "@/lib/payload/queries";
import { ArticleBody } from "@/components/articles/ArticleBody";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: `${t("contact")} | MFM Sport` };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pages" });
  const page = await getPageBySlug("contact", locale as Config["locale"]);

  return (
    <div className="container py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{page?.title || t("contact")}</h1>
      {page?.body ? (
        <ArticleBody content={page.body} />
      ) : (
        <p className="text-muted-foreground">{t("noContent")}</p>
      )}
    </div>
  );
}
