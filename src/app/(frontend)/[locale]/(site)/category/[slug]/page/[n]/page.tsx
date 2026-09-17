import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { cachedGetCategoryBySlug } from "@/lib/payload/cached-queries";
import { CategoryListing } from "@/components/articles/CategoryListing";
import { parsePageParam } from "@/lib/pagination";

// Deliberately DYNAMIC, like the article route. Slugs here are Arabic, and on
// Vercel an ISR render writes the path into a response header that Node then
// rejects — a 500 (lib/seo/isr.ts). Freshness and speed come from the data
// cache instead: every read below goes through lib/payload/cached-queries.
// A `revalidate` export used to sit here; it was inert — this route never had
// the generateStaticParams that ISR requires — and is gone so it cannot be
// mistaken for a working cache.

type Props = {
  params: Promise<{ locale: string; slug: string; n: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await cachedGetCategoryBySlug(slug, locale as Config["locale"]);
  if (!category) notFound();
  return {
    title: `${category.name} | MFM Sport`,
    description: category.description || undefined,
    robots: { index: false, follow: true },
  };
}

export default async function CategoryPageN({ params }: Props) {
  const { locale, slug, n } = await params;
  setRequestLocale(locale);
  const page = parsePageParam(n);
  if (page <= 1) redirect(`/${locale}/category/${slug}`);
  return <CategoryListing locale={locale} slug={slug} page={page} />;
}
