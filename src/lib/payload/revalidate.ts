import { revalidatePath, revalidateTag } from "next/cache";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
} from "payload";
import { ARTICLES_TAG, ADS_TAG, SETTINGS_TAG, TAXONOMY_TAG, articleTag } from "./cache-tags";

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
): Promise<{ paths: string[]; tags: string[] }> {
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
  const tags = Object.values(slugByLocale)
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .map(articleTag);
  return { paths: articlePaths(slugByLocale, categorySlugs), tags };
}

export const revalidateArticleChange: CollectionAfterChangeHook = async ({ doc, req, context }) => {
  // Bulk imports opt out. Outside a Next request there is no static-generation
  // store, so revalidateTag throws — harmlessly caught below, but it also costs
  // an extra findByID per row, which is 37,000 pointless round trips over an
  // archive import. The importer revalidates once when it finishes instead.
  if (context?.disableRevalidate) return doc;

  try {
    // Lists (latest, related, by tag/category) change on any publish: bust the
    // shared tag. The article's own cached doc has its own tag, so THIS
    // article is refreshed at once and every other article stays warm.
    revalidateTag(ARTICLES_TAG, "max");
    const { paths, tags } = await articleRevalidateTargets(req, doc.id);
    tags.forEach((t) => revalidateTag(t, "max"));
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
    // homepage, and (best-effort) this locale's article path and data entry.
    const slug = typeof doc?.slug === "string" ? doc.slug : undefined;
    if (slug) revalidateTag(articleTag(slug), "max");
    const slugByLocale = slug && req.locale ? { [req.locale]: slug } : {};
    articlePaths(slugByLocale, []).forEach((p) => revalidatePath(p));
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] article afterDelete failed");
  }
  return doc;
};

export const revalidateCategoryChange: CollectionAfterChangeHook = async ({ doc, req, context }) => {
  // See revalidateArticleChange — bulk imports create taxonomy on demand and
  // opt out of per-row revalidation.
  if (context?.disableRevalidate) return doc;

  try {
    // A renamed category shows on article category badges, so bust article
    // data too: lists via the shared tag, cached article docs via TAXONOMY_TAG.
    revalidateTag(ARTICLES_TAG, "max");
    revalidateTag(TAXONOMY_TAG, "max");
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
    revalidateTag(TAXONOMY_TAG, "max");
    const slug = typeof doc?.slug === "string" ? doc.slug : "";
    categoryPaths(slug).forEach((p) => revalidatePath(p));
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] category afterDelete failed");
  }
  return doc;
};

/**
 * Ads: every ad read — slots, carousels and the root layout's head snippets —
 * goes through the data cache under ADS_TAG, so busting the tag is what makes
 * a change visible. This used to also call `revalidatePath("/", "layout")`,
 * which discards every ISR page on the site: for the next hour or so after an
 * ad edit nothing was cached and every visitor paid a full render. The
 * homepage is the one page whose ad carousels an editor checks right after
 * saving, so it is revalidated explicitly; the rest pick the change up
 * within their own TTL.
 */
export const revalidateAdChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    revalidateTag(ADS_TAG, "max");
    for (const locale of LOCALES) revalidatePath(`/${locale}`);
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] ad afterChange failed");
  }
  return doc;
};

export const revalidateAdDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    revalidateTag(ADS_TAG, "max");
    for (const locale of LOCALES) revalidatePath(`/${locale}`);
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] ad afterDelete failed");
  }
  return doc;
};

/** Homepage Settings drive the homepage news filter + match panels AND the
 *  article-page matches sidebar; bust the homepage (and listings, since the
 *  article data cache feeds the tabs) plus every article page on change. */
export const revalidateHomepageChange: GlobalAfterChangeHook = async ({ doc, req }) => {
  try {
    revalidateTag(ARTICLES_TAG, "max");
    revalidateTag(SETTINGS_TAG, "max");
    for (const locale of LOCALES) revalidatePath(`/${locale}`);
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] homepage global afterChange failed");
  }
  return doc;
};

/** A competition's display order, crest or season decides which league every
 *  matches surface shows — including the article-page sidebar, which is a
 *  dynamic route reading through the data cache. Bust that cache on any
 *  competition write, or the site keeps featuring last season's league. */
export const revalidateCompetitionChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    revalidateTag(SETTINGS_TAG, "max");
    for (const locale of LOCALES) revalidatePath(`/${locale}`);
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] competition afterChange failed");
  }
  return doc;
};

export const revalidateCompetitionDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    revalidateTag(SETTINGS_TAG, "max");
    for (const locale of LOCALES) revalidatePath(`/${locale}`);
  } catch (err) {
    req.payload.logger.error({ err }, "[revalidate] competition afterDelete failed");
  }
  return doc;
};
