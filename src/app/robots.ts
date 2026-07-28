import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/siteUrl";

/**
 * Known content-scraper and AI-training crawlers that take bandwidth without
 * sending readers back. This is a politeness request, not a security control —
 * well-behaved crawlers honour it, and anything that ignores robots.txt needs to
 * be handled at the edge (Vercel WAF) instead.
 *
 * Search crawlers (Googlebot, Bingbot) and the AI assistants that actually cite
 * sources and drive referral traffic (ChatGPT-User, PerplexityBot) are
 * deliberately NOT listed — GA4 already shows an "AI Assistant" channel.
 */
const SCRAPER_AGENTS = [
  "AhrefsBot",
  "SemrushBot",
  "DotBot",
  "MJ12bot",
  "BLEXBot",
  "DataForSeoBot",
  "PetalBot",
  "SeekportBot",
  "Bytespider",
  "ImagesiftBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/_next/"],
      },
      {
        userAgent: SCRAPER_AGENTS,
        disallow: "/",
      },
    ],
    // Both feeds: the main sitemap (a sharded index once the archive lands) and
    // the rolling 48-hour Google News feed.
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
    host: SITE_URL,
  };
}
