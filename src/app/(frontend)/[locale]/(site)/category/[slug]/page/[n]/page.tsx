import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCategoryBySlug } from "@/lib/payload/queries";
import { CategoryListing } from "@/components/articles/CategoryListing";
import { parsePageParam } from "@/lib/pagination";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string; n: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategoryBySlug(slug, locale as Config["locale"]);
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
