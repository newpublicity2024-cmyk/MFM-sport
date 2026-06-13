import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTagBySlug } from "@/lib/payload/queries";
import { TagListing } from "@/components/tag/TagListing";
import { parsePageParam } from "@/lib/pagination";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string; n: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tag = await getTagBySlug(slug, locale as Config["locale"]);
  if (!tag) return { title: "Not Found" };
  return {
    title: `${tag.name} | MFM Sport`,
    robots: { index: false, follow: true },
  };
}

export default async function TagPageN({ params }: Props) {
  const { locale, slug, n } = await params;
  setRequestLocale(locale);
  const page = parsePageParam(n);
  if (page <= 1) redirect(`/${locale}/tag/${slug}`);
  return <TagListing locale={locale} slug={slug} page={page} />;
}
