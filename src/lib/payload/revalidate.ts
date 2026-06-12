import { revalidatePath, revalidateTag } from "next/cache";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from "payload";
import { ARTICLES_TAG, ADS_TAG } from "./cache-tags";

const LOCALES = ["ar", "fr", "en"] as const;

/** Pages affected when an article changes: homepage + listing per locale,
 *  the localized article page where a slug exists, and each category page. */
export function articlePaths(
  slugByLocale: Partial<Record<string, string>>,
  categorySlugs: string[],
): string[] {
  const paths = new Set<string>();
  for (const locale of LOCALES) {
    paths.add(`/${locale}`);
    paths.add(`/${locale}/articles`);
    const slug = slugByLocale[locale];
    if (slug) paths.add(`/${locale}/articles/${slug}`);
    for (const c of categorySlugs) {
      if (c) paths.add(`/${locale}/category/${c}`);
    }
  }
  return [...paths];
}

/** Pages affected when a category changes (category slug is not localized). */
export function categoryPaths(categorySlug: string): string[] {
  const paths = new Set<string>();
  for (const locale of LOCALES) {
    paths.add(`/${locale}`);
    paths.add(`/${locale}/articles`);
    if (categorySlug) paths.add(`/${locale}/category/${categorySlug}`);
  }
  return [...paths];
}

/** Re-fetch the article across all locales to collect localized slugs + category slugs. */
async function articleRevalidateTargets(
  req: Parameters<CollectionAfterChangeHook>[0]["req"],
  id: string | number,
): Promise<string[]> {
  const doc = await req.payload.findByID({
    collection: "articles",
    id,
    locale: "all",
    depth: 1,
  });
  const slugByLocale = doc.slug as unknown as Partial<Record<string, string>>;
  const cats = Array.isArray(doc.categories) ? doc.categories : [];
  const categorySlugs = cats
    .map((c: unknown) =>
      c && typeof c === "object" && "slug" in c ? (c as { slug?: string }).slug : undefined,
    )
    .filter((s): s is string => Boolean(s));
  return articlePaths(slugByLocale, categorySlugs);
}

export const revalidateArticleChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    // Invalidate the dynamic article route's data cache (see cached-queries.ts)
    // so an edit/publish is visible immediately, not after the 5-min TTL.
    revalidateTag(ARTICLES_TAG, "max");
    const paths = await articleRevalidateTargets(req, doc.id);
    paths.forEach((p) => revalidatePath(p));
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] article afterChange failed");
  }
  return doc;
};

export const revalidateArticleDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    revalidateTag(ARTICLES_TAG, "max");
    // The doc is the just-deleted record in req's locale; revalidate listings,
    // homepage, and (best-effort) this locale's article path.
    const slug = typeof doc?.slug === "string" ? doc.slug : undefined;
    const slugByLocale = slug && req.locale ? { [req.locale]: slug } : {};
    articlePaths(slugByLocale, []).forEach((p) => revalidatePath(p));
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] article afterDelete failed");
  }
  return doc;
};

export const revalidateCategoryChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    // A renamed category shows on article category badges, so bust article data too.
    revalidateTag(ARTICLES_TAG, "max");
    const slug = typeof doc?.slug === "string" ? doc.slug : "";
    categoryPaths(slug).forEach((p) => revalidatePath(p));
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] category afterChange failed");
  }
  return doc;
};

export const revalidateCategoryDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    revalidateTag(ARTICLES_TAG, "max");
    const slug = typeof doc?.slug === "string" ? doc.slug : "";
    categoryPaths(slug).forEach((p) => revalidatePath(p));
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] category afterDelete failed");
  }
  return doc;
};

/** Ads are cached per-locale in the article route's data cache; bust on any change. */
export const revalidateAdChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    revalidateTag(ADS_TAG, "max");
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] ad afterChange failed");
  }
  return doc;
};

export const revalidateAdDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    revalidateTag(ADS_TAG, "max");
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] ad afterDelete failed");
  }
  return doc;
};
