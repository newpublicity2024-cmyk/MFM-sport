import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTagBySlug } from "@/lib/payload/queries";
import { TagListing } from "@/components/tag/TagListing";

// ISR: page 1 is now a path-segment route (pagination lives at /page/[n]), so the
// base listing no longer reads searchParams and can be edge-cached.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tag = await getTagBySlug(slug, locale as Config["locale"]);
  if (!tag) notFound();
  return {
    title: `${tag.name} | MFM Sport`,
  };
}

export default async function TagPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <TagListing locale={locale} slug={slug} page={1} />;
}
