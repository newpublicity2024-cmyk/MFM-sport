import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getCategoryBySlug } from "@/lib/payload/queries";
import { CategoryListing } from "@/components/articles/CategoryListing";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategoryBySlug(slug, locale as Config["locale"]);
  if (!category) notFound();
  return {
    title: `${category.name} | MFM Sport`,
    description: category.description || undefined,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <CategoryListing locale={locale} slug={slug} page={1} />;
}
