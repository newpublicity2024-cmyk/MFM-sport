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
  // Meta's AI-training crawler (not facebookexternalhit, which builds link
  // previews and stays allowed). On 21 September 2026 it made 50,632 requests
  // to /ar/matches?date=…&league=… in eleven hours — every one a function
  // invocation — and tripped Vercel's edge-request and invocation alerts.
  "meta-externalagent",
  // Anthropic's training crawler (Claude-User / Claude-SearchBot, which fetch
  // on a reader's behalf, are different agents and stay allowed).
  "ClaudeBot",
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
        // The matches page's ?date= / ?league= links form an unbounded URL
        // space (every day links to seven more days, times every league);
        // crawlers walk it forever and each hit is a dynamic render. The
        // page itself stays crawlable; its filtered variants do not.
        disallow: ["/admin/", "/api/", "/_next/", "/*?date=", "/*?league=", "/*&league="],
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
