import { getPayload } from "payload";
import configPromise from "@payload-config";
import type { Config } from "@/payload-types";

// Cache the RSS render for an hour at the framework level (was relying only on an
// HTTP header) so repeat crawler hits don't re-query Payload each time.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mfmsport.ma";

const LOCALE_NAMES: Record<string, string> = {
  ar: "MFM Sport - أخبار الكرة المغربية",
  fr: "MFM Sport - Actualites du football marocain",
  en: "MFM Sport - Moroccan Football News",
};

const LOCALE_DESCRIPTIONS: Record<string, string> = {
  ar: "آخر أخبار كرة القدم المغربية والعالمية",
  fr: "Les dernieres actualites du football marocain et mondial",
  en: "Latest Moroccan and world football news",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const payload = await getPayload({ config: configPromise });

  const articles = await payload.find({
    collection: "articles",
    where: { status: { equals: "published" } },
    locale: locale as Config["locale"],
    limit: 50,
    sort: "-publishedAt",
    depth: 1,
  });

  const items = articles.docs
    .map((article) => {
      const url = `${SITE_URL}/${locale}/articles/${article.slug}`;
      const pubDate = article.publishedAt
        ? new Date(article.publishedAt).toUTCString()
        : new Date(article.createdAt).toUTCString();

      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(article.excerpt || "")}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(LOCALE_NAMES[locale] || LOCALE_NAMES.en)}</title>
    <link>${SITE_URL}/${locale}</link>
    <description>${escapeXml(LOCALE_DESCRIPTIONS[locale] || LOCALE_DESCRIPTIONS.en)}</description>
    <language>${locale}</language>
    <atom:link href="${SITE_URL}/${locale}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
