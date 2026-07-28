import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArticlesListing } from "@/components/articles/ArticlesListing";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "article" });
  return {
    alternates: { canonical: `/${locale}/articles` },
    title: `${t("allArticles")} | MFM Sport`,
  };
}

export default async function ArticlesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ArticlesListing locale={locale} page={1} />;
}
