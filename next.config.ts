import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    // Serve images directly without Vercel's optimizer.
    // Prevents exhausting the image-optimization quota (which made images fail to load).
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.api-sports.io",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        // Uploaded media now resolves to the Vercel Blob CDN directly
        // (see src/lib/storage/blobUrl.ts). Allow any blob store subdomain.
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
      {
        pathname: '/images/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ]
    return [
      {
        // Apply to everything EXCEPT the Payload admin, which needs framing/eval freedom.
        source: "/((?!admin).*)",
        headers: securityHeaders,
      },
    ]
  },
  async redirects() {
    return [
      {
        // Retired-locale RSS feeds: middleware skips dotted paths, so redirect the
        // French/English feeds to the Arabic feed here (mirrors the /fr,/en -> /ar
        // locale redirect in middleware.ts).
        source: "/:locale(fr|en)/feed.xml",
        destination: "/ar/feed.xml",
        permanent: true,
      },
      // --- Legacy WordPress sitemaps -----------------------------------------
      // The old site ran Yoast SEO: /sitemap_index.xml fanning out to
      // /post-sitemap1.xml ... /post-sitemap144.xml (200 URLs each), plus
      // category/club/page/images/audio/poll shards (Wayback CDX, 2022-2024).
      // Google still requests those URLs, and until now every one was a bare
      // 404: middleware's matcher skips dotted paths, so they never reached the
      // redirect lookup. A permanent redirect to the live sitemap is how Google
      // discovers the replacement without anyone touching Search Console.
      // /news-sitemap.xml keeps its old path and is served directly - no rule.
      {
        source: "/sitemap_index.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source:
          "/:type(post|category|club|page|images|audio|poll|post_tag|author|video|attachment|local)-sitemap:n(\\d*).xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        // WordPress core's own sitemap shape, in case it was ever exposed.
        source: "/wp-sitemap:rest(.*).xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
      {
        source: "/sitemap.xml.gz",
        destination: "/sitemap.xml",
        permanent: true,
      },
      // --- Legacy WordPress archive paths ------------------------------------
      // Article URLs are handled per-row by middleware + the redirects
      // collection. These are the hub/archive shapes, which have no rows.
      // WP nested categories to the flat category route: the slugs were carried
      // over unchanged, so the last segment is the new slug; a slug that no
      // longer exists lands on the real 404, never the homepage.
      {
        source: "/category/:parents*/:slug",
        destination: "/ar/category/:slug",
        permanent: true,
      },
      { source: "/club/:slug", destination: "/ar/club/:slug", permanent: true },
      { source: "/tag/:slug", destination: "/ar/tag/:slug", permanent: true },
      {
        source: "/articles/page/:n(\\d+)",
        destination: "/ar/articles/page/:n",
        permanent: true,
      },
      { source: "/articles", destination: "/ar/articles", permanent: true },
      {
        // Old match programme / standings pages.
        source: "/:old(tournaments|matchs)",
        destination: "/ar/matches",
        permanent: true,
      },
      {
        // Old "most viewed" archive (Google still holds /most-viewed/page/440/).
        source: "/most-viewed/:rest*",
        destination: "/ar/articles",
        permanent: true,
      },
      {
        source: "/:locale/articles",
        // Only redirect page>=2; ?page=1 (and ?page=0) just render the base listing.
        has: [{ type: "query", key: "page", value: "(?<n>[2-9]|[1-9]\\d+)" }],
        destination: "/:locale/articles/page/:n",
        permanent: true,
      },
      {
        source: "/:locale/category/:slug",
        // Only redirect page>=2; ?page=1 (and ?page=0) just render the base listing.
        has: [{ type: "query", key: "page", value: "(?<n>[2-9]|[1-9]\\d+)" }],
        destination: "/:locale/category/:slug/page/:n",
        permanent: true,
      },
    ];
  },
}

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
