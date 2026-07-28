import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getAuthorBySlug } from "@/lib/payload/queries";
import { AuthorListing } from "@/components/author/AuthorListing";

// ISR: page 1 is now a path-segment route (pagination lives at /page/[n]), so the
// base listing no longer reads searchParams and can be edge-cached.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const author = await getAuthorBySlug(slug, locale as Config["locale"]);
  if (!author) notFound();
  return {
    title: `${author.name} | MFM Sport`,
    description: author.bio || undefined,
  };
}

export default async function AuthorPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <AuthorListing locale={locale} slug={slug} page={1} />;
}
