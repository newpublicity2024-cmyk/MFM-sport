import { postgresAdapter } from '@payloadcms/db-postgres'
import { BlocksFeature, FixedToolbarFeature, lexicalEditor, UploadFeature } from '@payloadcms/richtext-lexical'
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
import { SocialEmbedBlock } from './blocks/SocialEmbed'
import { GalleryBlock } from './blocks/Gallery'
import { AudioBlock } from './blocks/Audio'
import { EmbedFrameBlock } from './blocks/EmbedFrame'

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
  // Journalist authoring blocks (Task 4), now reachable from the toolbar (Task 8).
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      // defaultFeatures spreads first so UploadFeature (content images) and everything
      // else already in use survives. The bare UploadFeature() inside defaultFeatures
      // and the customised one below share the feature key "upload" — Payload resolves
      // duplicate keys by last-registered-wins (see loadFeatures() in
      // @payloadcms/richtext-lexical's lexical/config/server/loader.js), so ours
      // overrides the bare default rather than running alongside it.
      ...defaultFeatures,
      // The default feature set carries only InlineToolbarFeature, which appears when
      // text is selected. Without a fixed toolbar, the only way to insert a block is
      // typing "/" and knowing the English command name — unusable for an Arabic-
      // language newsroom, and worse on touch. FixedToolbarFeature adds the persistent
      // toolbar row (with its own "+" blocks dropdown, Arabic-labelled per block below)
      // that a journalist can tap without knowing any command syntax.
      FixedToolbarFeature(),
      UploadFeature({
        collections: {
          media: {
            // Per-usage fields for THIS placement of the image in THIS article body —
            // distinct from Media.caption, which is the media doc's own default. Alt
            // text intentionally stays on the media doc only (brief §3), not repeated
            // here.
            fields: [
              {
                name: 'caption',
                type: 'text',
                label: { en: 'Caption', fr: 'Légende', ar: 'التعليق' },
                admin: {
                  description: {
                    en: 'Shown beneath this image in the article. Leave blank to show none.',
                    fr: "Affichée sous cette image dans l'article. Laissez vide pour n'en afficher aucune.",
                    ar: 'تظهر أسفل هذه الصورة داخل المقال. اتركها فارغة لعدم عرض أي تعليق.',
                  },
                },
              },
              {
                name: 'credit',
                type: 'text',
                label: { en: 'Credit', fr: 'Crédit', ar: 'المصدر' },
                admin: {
                  description: {
                    en: 'Photo credit / source, shown alongside the caption.',
                    fr: 'Crédit photo / source, affiché avec la légende.',
                    ar: 'مصدر الصورة، يظهر بجانب التعليق.',
                  },
                },
              },
            ],
          },
        },
      }),
      BlocksFeature({
        blocks: [SocialEmbedBlock, GalleryBlock, AudioBlock, EmbedFrameBlock],
      }),
    ],
  }),
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
