/**
 * Generate a clean, ASCII, URL-safe slug from a (translated) title. Latin titles
 * survive; diacritics are stripped via NFD ("l'armée" -> "larmee"). Non-Latin
 * input may produce "" — callers must provide a fallback. Extends the
 * character-class replacements in scripts/migrate-wp.ts (adds NFD diacritic
 * stripping) so slugs stay consistent across the codebase.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** slugify with a guaranteed-non-empty result (fallback is typically the id). */
export function slugifyWithFallback(text: string, fallback: string): string {
  const s = slugify(text);
  return s || slugify(fallback) || fallback;
}
