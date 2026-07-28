import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArticlesListing } from "@/components/articles/ArticlesListing";
import { parsePageParam } from "@/lib/pagination";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; n: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "article" });
  return {
    title: `${t("allArticles")} | MFM Sport`,
    robots: { index: false, follow: true },
  };
}

export default async function ArticlesPageN({ params }: Props) {
  const { locale, n } = await params;
  setRequestLocale(locale);
  const page = parsePageParam(n);
  if (page <= 1) redirect(`/${locale}/articles`);
  return <ArticlesListing locale={locale} page={page} />;
}
