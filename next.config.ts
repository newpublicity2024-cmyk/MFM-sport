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
