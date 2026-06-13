import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VideosListing } from "@/components/videos/VideosListing";
import { parsePageParam } from "@/lib/pagination";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; n: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "videos" });
  return {
    title: `${t("title")} | MFM Sport`,
    robots: { index: false, follow: true },
  };
}

export default async function VideosPageN({ params }: Props) {
  const { locale, n } = await params;
  setRequestLocale(locale);
  const page = parsePageParam(n);
  if (page <= 1) redirect(`/${locale}/videos`);
  return <VideosListing locale={locale} page={page} />;
}
