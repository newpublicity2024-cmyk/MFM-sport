import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VideosListing } from "@/components/videos/VideosListing";

// ISR: the videos page renders the two YouTube playlists (no pagination), so it
// can be edge-cached and refreshed hourly alongside the YouTube sync.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "videos" });
  return { title: `${t("title")} | MFM Sport`, alternates: { canonical: `/${locale}/videos` }, };
}

export default async function VideosPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VideosListing locale={locale} />;
}
