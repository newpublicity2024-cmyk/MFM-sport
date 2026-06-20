import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { ar } from '@payloadcms/translations/languages/ar'
import { en } from '@payloadcms/translations/languages/en'
import { fr } from '@payloadcms/translations/languages/fr'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
import { Authors } from './collections/Authors'
import { Articles } from './collections/Articles'
import { Competitions } from './collections/Competitions'
import { Clubs } from './collections/Clubs'
import { Subscribers } from './collections/Subscribers'
import { Pages } from './collections/Pages'
import { Redirects } from './collections/Redirects'
import { Videos } from './collections/Videos'
import { Ads } from './collections/Ads'
import { Homepage } from './globals/Homepage'
import { blobBaseUrl, blobFileURL } from './lib/storage/blobUrl'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.PAYLOAD_SECRET) {
  throw new Error('PAYLOAD_SECRET environment variable is required')
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const plugins: any[] = []
if (process.env.BLOB_READ_WRITE_TOKEN) {
  const blobBase = blobBaseUrl()
  plugins.push(
    vercelBlobStorage({
      collections: {
        media: {
          // Resolve each media `url` (and every image size) to the public Blob CDN
          // URL at read time, so the browser fetches image bytes straight from blob
          // instead of through the DB-backed `/api/media/file` function. This applies
          // to existing AND new media — no backfill needed — and keeps images loading
          // from ISR-cached pages even during a DB outage (the cause of the Arabic-
          // filename 500s). We intentionally do NOT set `disablePayloadAccessControl`,
          // so the legacy `/api/media/file` route stays registered as a fallback for
          // any already-cached HTML. Falls back to the Payload path in envs without a
          // blob base (e.g. local dev). See src/lib/storage/blobUrl.ts.
          generateFileURL: ({ filename }) =>
            blobFileURL(filename as string, blobBase) ??
            `/api/media/file/${encodeURIComponent(filename as string)}`,
        },
      },
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
  )
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Categories, Tags, Authors, Articles, Competitions, Clubs, Subscribers, Pages, Redirects, Videos, Ads],
  globals: [Homepage],
  // Admin-panel languages. Each user picks their language in account settings;
  // العربية switches the whole panel to Arabic + RTL. Default stays English.
  i18n: {
    supportedLanguages: { en, fr, ar },
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // Migration-only schema management. push:true (the default) would let dev runs
    // and any getPayload() script destructively auto-sync the schema and bypass
    // migrations (e.g. silently drop the localized article slug). All schema
    // changes now go through reviewed migrations applied via `pnpm payload migrate`.
    push: false,
    pool: {
      connectionString: process.env.DATABASE_URL,
    },
  }),
  localization: {
    locales: [
      { label: 'العربية', code: 'ar' },
      { label: 'Français', code: 'fr' },
      { label: 'English', code: 'en' },
    ],
    defaultLocale: 'ar',
    fallback: true,
  },
  sharp,
  plugins,
})
