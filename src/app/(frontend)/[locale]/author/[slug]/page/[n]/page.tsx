import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getAuthorBySlug } from "@/lib/payload/queries";
import { AuthorListing } from "@/components/author/AuthorListing";
import { parsePageParam } from "@/lib/pagination";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string; n: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const author = await getAuthorBySlug(slug, locale as Config["locale"]);
  if (!author) notFound();
  return {
    title: `${author.name} | MFM Sport`,
    description: author.bio || undefined,
    robots: { index: false, follow: true },
  };
}

export default async function AuthorPageN({ params }: Props) {
  const { locale, slug, n } = await params;
  setRequestLocale(locale);
  const page = parsePageParam(n);
  if (page <= 1) redirect(`/${locale}/author/${slug}`);
  return <AuthorListing locale={locale} slug={slug} page={page} />;
}
