// Helpers for pointing media URLs straight at the Vercel Blob CDN.
//
// Media is served through Payload's `/api/media/file/<name>` endpoint, which runs
// inside a serverless function and reads from Blob via the DB-backed request
// pipeline. When the database is unavailable (e.g. a Neon quota suspension) every
// uncached media request throws an unhandled 500 — and on cache-miss the newest
// (Arabic-named) files take the brunt. Resolving each media `url` to the public
// Blob URL at read time makes the browser fetch image bytes directly from the
// CDN: no function, no DB. ISR-cached pages then keep loading images even while
// the DB is down.
//
// `blobBaseUrl` mirrors how `@payloadcms/storage-vercel-blob` derives its base
// URL (parse the store id out of the RW token), so the URLs we generate match the
// keys the adapter uploaded under.

export function blobBaseUrl(
  token: string | undefined = process.env.BLOB_READ_WRITE_TOKEN,
  override: string | undefined = process.env.STORAGE_VERCEL_BLOB_BASE_URL,
): string | null {
  if (override) return override.replace(/\/+$/, "");
  const storeId = token?.match(/^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i)?.[1]?.toLowerCase();
  return storeId ? `https://${storeId}.public.blob.vercel-storage.com` : null;
}

// Public Blob URL for a stored filename. Our media collection uses no prefix, so
// the blob key is just the filename; we encode the basename exactly like the
// adapter's own `generateURL` (encodeURIComponent). Returns null when no blob
// base is configured (e.g. local dev without a token) so callers can fall back to
// the Payload-served path.
export function blobFileURL(
  filename: string | undefined | null,
  base: string | null = blobBaseUrl(),
): string | null {
  if (!base || !filename) return null;
  return `${base}/${encodeURIComponent(filename)}`;
}
