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
