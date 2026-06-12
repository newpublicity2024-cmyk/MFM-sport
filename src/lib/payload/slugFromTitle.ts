import type { FieldHook } from "payload";

/**
 * Turn an article title into a slug: lower-case, spaces → dashes, punctuation
 * dropped — but EVERY script's letters are kept (Arabic, Latin, …). This is
 * deliberately NOT `slugify()` from ./slugify, which strips non-ASCII and would
 * blank out Arabic titles. Mirrors the existing Arabic slug style, e.g.
 * "نصير مزراوي يعود" → "نصير-مزراوي-يعود".
 */
export function titleToSlug(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    // keep letters (\p{L}), numbers (\p{N}) and combining marks (\p{M}, e.g.
    // Arabic vowel diacritics); drop everything else except whitespace/dash.
    .replace(/[^\p{L}\p{N}\p{M}\s-]+/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Field `beforeValidate` hook for the localized `slug` field. Runs once per
 * locale: if no slug is supplied for that locale, derive it from that locale's
 * title (so each language gets its own slug), guaranteeing uniqueness within the
 * locale by appending -2, -3, … on collision. An explicitly-set slug is kept,
 * so existing articles (and their redirects) are never rewritten on edit.
 */
export const slugFromTitle: FieldHook = async ({ value, siblingData, originalDoc, req, collection }) => {
  if (typeof value === "string" && value.trim()) return value.trim();

  const title =
    (siblingData as { title?: unknown })?.title ?? (originalDoc as { title?: unknown })?.title;
  if (typeof title !== "string" || !title.trim()) return value;

  const base = titleToSlug(title);
  if (!base) return value;
  if (!req?.payload) return base;

  const selfId = (originalDoc as { id?: string | number })?.id;
  const locale = req.locale && req.locale !== "all" ? req.locale : undefined;
  const collectionSlug = collection?.slug ?? "articles";

  let candidate = base;
  for (let n = 2; n < 60; n++) {
    const where: Record<string, unknown> = { slug: { equals: candidate } };
    if (selfId != null) where.id = { not_equals: selfId };
    const res = await req.payload.find({
      collection: collectionSlug as never,
      where: where as never,
      locale: locale as never,
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    });
    if (!res.docs.length) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${selfId ?? ""}`;
};
