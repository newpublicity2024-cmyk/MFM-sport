/**
 * The tag chips of the homepage "latest news" section.
 *
 * Admin-chosen first (Homepage Settings → latestNewsTags, in order). When that
 * list is empty the chips are derived from the articles already on the page:
 * the tags the latest articles carry, most frequent first, so a fresh install
 * or an editor who never opened the setting still gets a working filter. The
 * derived set is capped so the chip row stays a row.
 */

export type TagChip = {
  id: string;
  /** Already localized by the locale-aware Payload read. */
  name: string;
  slug: string;
};

/** Upper bound on derived chips — the admin list is not capped. */
export const MAX_DERIVED_TAG_CHIPS = 8;

/** A tag needs at least this many of the latest articles to earn a derived chip. */
export const MIN_DERIVED_TAG_ARTICLES = 2;

type TagLike = { id?: unknown; name?: unknown; slug?: unknown };

function toChip(value: unknown): TagChip | null {
  if (!value || typeof value !== "object") return null;
  const t = value as TagLike;
  if (t.id == null || typeof t.name !== "string" || typeof t.slug !== "string") return null;
  if (t.name.trim() === "") return null;
  return { id: String(t.id), name: t.name, slug: t.slug };
}

/** Homepage Settings rows (depth-2 populated) → chips, admin order, no duplicates. */
export function chipsFromSettings(rows: unknown): TagChip[] {
  const out: TagChip[] = [];
  const seen = new Set<string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const chip = toChip((row as { tag?: unknown })?.tag);
    if (!chip || seen.has(chip.id)) continue;
    seen.add(chip.id);
    out.push(chip);
  }
  return out;
}

/**
 * Chips derived from a list of articles (depth-2, so `tags` are populated):
 * tags ordered by how many of the articles carry them, ties by first
 * appearance, dropping tags under the article threshold.
 */
export function chipsFromArticles(
  articles: unknown[],
  limit = MAX_DERIVED_TAG_CHIPS,
  minArticles = MIN_DERIVED_TAG_ARTICLES,
): TagChip[] {
  const counts = new Map<string, { chip: TagChip; n: number; first: number }>();
  let position = 0;
  for (const article of articles ?? []) {
    const tags = (article as { tags?: unknown })?.tags;
    if (!Array.isArray(tags)) continue;
    for (const raw of tags) {
      const chip = toChip(raw);
      if (!chip) continue;
      const entry = counts.get(chip.id);
      if (entry) entry.n += 1;
      else counts.set(chip.id, { chip, n: 1, first: position++ });
    }
  }
  return [...counts.values()]
    .filter((e) => e.n >= minArticles)
    .sort((a, b) => b.n - a.n || a.first - b.first)
    .slice(0, limit)
    .map((e) => e.chip);
}

/** The rule in one place: the admin's list, else derived from the latest articles. */
export function resolveLatestNewsTags(settingsRows: unknown, latestArticles: unknown[]): TagChip[] {
  const chosen = chipsFromSettings(settingsRows);
  return chosen.length > 0 ? chosen : chipsFromArticles(latestArticles);
}
