import { sql } from "@payloadcms/db-postgres/drizzle";
import type { Config } from "@/payload-types";
import { getPayloadClient } from "@/lib/payload/queries";
import { isBrokenTaxonomySlug } from "@/lib/payload/slugFromTitle";
import type { TagChip } from "./latestNewsTags";

type Locale = Config["locale"];
type RankedRow = { id: number | string; n: number };

/**
 * The site's tags ranked by how many published articles carry them.
 *
 * Payload's local API has no GROUP BY, and walking every article to count
 * tags (what the sitemap does) is too slow for a page that re-renders every
 * five minutes, so this is one SQL aggregate over the relationship table.
 * The table and column names are Payload's derived ones (`articles_rels`,
 * `parent_id`, `tags_id`, `path`), read from the live schema on 17 September
 * 2026 — the same names the archive-import scripts rely on. The names go
 * through the query once, here, so a rename shows up in one place.
 *
 * Returns chips in rank order, localized. Tags whose slug is still broken
 * (WP-import leftovers awaiting a merge) are skipped: their chip would filter
 * fine but link nowhere.
 */
export async function getTopTags(locale: Locale, limit: number): Promise<TagChip[]> {
  const payload = await getPayloadClient();
  // Over-fetch a little so the broken-slug filter below cannot leave the row short.
  const fetchLimit = Math.ceil(limit * 1.25);
  const result = (await payload.db.drizzle.execute(sql`
    SELECT r.tags_id AS id, count(*)::int AS n
    FROM articles_rels r
    JOIN articles a ON a.id = r.parent_id
    WHERE r.path = 'tags' AND a.status = 'published' AND r.tags_id IS NOT NULL
    GROUP BY r.tags_id
    ORDER BY n DESC, r.tags_id ASC
    LIMIT ${fetchLimit}
  `)) as RankedRow[] | { rows: RankedRow[] };
  // node-postgres hands back a QueryResult ({ rows }); other drizzle drivers
  // return the rows directly. Accept both rather than guess the driver.
  const rows = Array.isArray(result) ? result : result.rows;

  const ids = rows.map((r) => Number(r.id));
  if (ids.length === 0) return [];

  const tags = await payload.find({
    collection: "tags",
    where: { id: { in: ids } },
    locale,
    limit: ids.length,
    pagination: false,
    depth: 0,
  });
  const byId = new Map(tags.docs.map((t) => [Number(t.id), t]));

  const out: TagChip[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (!t || typeof t.name !== "string" || t.name.trim() === "") continue;
    if (isBrokenTaxonomySlug(t.slug)) continue;
    out.push({ id: String(t.id), name: t.name, slug: t.slug });
    if (out.length >= limit) break;
  }
  return out;
}
