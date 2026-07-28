import { getPayload } from "payload";
import configPromise from "@payload-config";
import { SITE_URL } from "@/lib/seo/siteUrl";
import { isIndexable, type SeoTier } from "@/lib/seo/indexation";

/**
 * Google News sitemap — articles published in the last 48 hours only.
 *
 * This is how competitors surface in Top Stories. It is a route handler rather
 * than a MetadataRoute sitemap because Next's sitemap type cannot emit the
 * `news:` namespace.
 *
 * Regenerated every 15 minutes: a news sitemap is worthless if it lags the
 * newsroom, and the response is tiny (a day or two of articles).
 */
export const revalidate = 900;

const WINDOW_HOURS = 48;

/**
 * Hard floor on publish dates, independent of the 48-hour window.
 *
 * The WordPress backfill imports ~37,000 articles dating back to 2010. If any of
 * them ever leaked into this feed, Google would see a decade of archive
 * presented as breaking news published at once — which is exactly the kind of
 * thing that costs a publisher its Google News standing.
 *
 * The 48-hour window alone is nearly sufficient, but it is computed from clock
 * arithmetic, and a timezone bug, a bad `publishedAt` during import, or a clock
 * skew would all defeat it. This floor is a second, independent guard: nothing
 * published before the site went Arabic-only can appear here regardless of what
 * the window computes. Raise it if the archive is ever re-dated.
 */
const NEVER_BEFORE = Date.parse("2026-06-01T00:00:00Z");

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET() {
  const payload = await getPayload({ config: configPromise });

  const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();

  const res = await payload.find({
    collection: "articles",
    where: {
      status: { equals: "published" },
      publishedAt: { greater_than: since },
    },
    locale: "ar",
    limit: 1000,
    depth: 0,
    select: { slug: true, title: true, publishedAt: true, seoTier: true },
    sort: "-publishedAt",
  });

  const items = res.docs.filter((doc) => {
    const a = doc as { publishedAt?: string; seoTier?: SeoTier; slug?: string; title?: string };
    if (!a.slug || !a.publishedAt) return false;
    const ts = Date.parse(a.publishedAt);
    if (!Number.isFinite(ts) || ts < NEVER_BEFORE) return false;  // archive guard
    if (ts > Date.now() + 60_000) return false;                    // future-dated
    // Never advertise something the staged release is holding at noindex.
    return isIndexable(a);
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items
  .map((doc) => {
    const a = doc as { slug: string; title: string; publishedAt: string };
    return `  <url>
    <loc>${xmlEscape(`${SITE_URL}/ar/articles/${encodeURIComponent(a.slug)}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>MFM Sport</news:name>
        <news:language>ar</news:language>
      </news:publication>
      <news:publication_date>${new Date(a.publishedAt).toISOString()}</news:publication_date>
      <news:title>${xmlEscape(a.title ?? "")}</news:title>
    </news:news>
  </url>`;
  })
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
