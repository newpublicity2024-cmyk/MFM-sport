import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VideosListing } from "@/components/videos/VideosListing";

// ISR: page 1 is now a path-segment route (pagination lives at /page/[n]), so the
// base listing no longer reads searchParams and can be edge-cached.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "videos" });
  return { title: `${t("title")} | MFM Sport` };
}

export default async function VideosPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VideosListing locale={locale} page={1} />;
}
