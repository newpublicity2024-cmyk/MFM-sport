import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { cachedGetTagBySlug } from "@/lib/payload/cached-queries";
import { TagListing } from "@/components/tag/TagListing";

// Deliberately DYNAMIC, like the article route. Slugs here are Arabic, and on
// Vercel an ISR render writes the path into a response header that Node then
// rejects — a 500 (lib/seo/isr.ts). Freshness and speed come from the data
// cache instead: every read below goes through lib/payload/cached-queries.
// A `revalidate` export used to sit here; it was inert — this route never had
// the generateStaticParams that ISR requires — and is gone so it cannot be
// mistaken for a working cache.

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const tag = await cachedGetTagBySlug(slug, locale as Config["locale"]);
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
