/**
 * Normalize a slug coming from a Next.js dynamic route param before looking it
 * up in Payload.
 *
 * Why: our slugs are stored decoded (e.g. Arabic "الجيش-الملكي"), but Next.js is
 * inconsistent about whether `params.slug` arrives decoded or still
 * percent-encoded ("%D8%A7..."). When it arrives encoded, an exact `slug equals`
 * match against the decoded stored value finds nothing and the page 404s.
 *
 * Decoding is idempotent for already-decoded slugs (Arabic/ASCII contain no
 * "%xx" escapes), so this is always safe to call. A malformed percent sequence
 * makes decodeURIComponent throw, in which case we fall back to the raw value.
 */
export function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
