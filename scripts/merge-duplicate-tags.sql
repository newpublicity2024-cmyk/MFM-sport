-- Merge the duplicate tags left by the WordPress import into their editor-
-- created twins, then delete the duplicates.
--
-- Context (17 September 2026): after `scripts/normalize-taxonomy-slugs.ts`,
-- 273 tags still had unreachable slugs (percent-encoded or with whitespace).
-- Each has exactly one working tag with the same Arabic name — the importer
-- created one, an editor created the other. 1,614 article↔tag links sit on
-- the duplicates, none overlapping their twin. Merging repoints those links
-- and the homepage news-filter references, then deletes the duplicate rows.
-- `articles_rels.tags_id` and `tags_locales._parent_id` cascade on delete;
-- `homepage_news_filters.tag_id` is ON DELETE SET NULL, hence its own UPDATE.
--
-- Safe to re-run: a second run finds zero pairs. Broken tags whose name
-- matches more than one working tag are left alone (HAVING count(*) = 1).
--
-- Run it on a Neon branch first, read the final SELECT, then on main:
--   psql "$DATABASE_URL" -f scripts/merge-duplicate-tags.sql
-- Expected on main (before any run): pairs=273, rels_on_broken=1614,
-- tags_after = tags_before - 273, still_broken=0, dup_article_tag_links=0,
-- tag_rels_after = tag_rels_before - (overlapping links deleted; 0 measured).

BEGIN;

CREATE TEMP TABLE merge_pairs AS
WITH broken AS (
  SELECT id FROM tags WHERE slug ~ '\s' OR slug ~* '%[0-9a-f]{2}'
),
cand AS (
  SELECT b.id AS broken_id, k.id AS keep_id
  FROM broken b
  JOIN tags_locales bl ON bl._parent_id = b.id AND bl._locale = 'ar'
  JOIN tags_locales kl ON kl._locale = 'ar'
                      AND btrim(kl.name) = btrim(bl.name)
                      AND kl._parent_id <> b.id
  JOIN tags k ON k.id = kl._parent_id
             AND NOT (k.slug ~ '\s' OR k.slug ~* '%[0-9a-f]{2}')
)
SELECT broken_id, min(keep_id) AS keep_id
FROM cand
GROUP BY broken_id
HAVING count(*) = 1;

CREATE TEMP TABLE merge_before AS
SELECT
  (SELECT count(*) FROM merge_pairs)                                                        AS pairs,
  (SELECT count(*) FROM articles_rels WHERE tags_id IN (SELECT broken_id FROM merge_pairs)) AS rels_on_broken,
  (SELECT count(*) FROM homepage_news_filters WHERE tag_id IN (SELECT broken_id FROM merge_pairs)) AS filters_on_broken,
  (SELECT count(*) FROM articles_rels WHERE tags_id IS NOT NULL)                            AS tag_rels_total,
  (SELECT count(*) FROM tags)                                                               AS tags_total;

-- An article already linked to the twin keeps one link, not two.
DELETE FROM articles_rels r
USING merge_pairs p
WHERE r.tags_id = p.broken_id
  AND EXISTS (SELECT 1 FROM articles_rels y WHERE y.tags_id = p.keep_id AND y.parent_id = r.parent_id);

UPDATE articles_rels r SET tags_id = p.keep_id
FROM merge_pairs p WHERE r.tags_id = p.broken_id;

UPDATE homepage_news_filters f SET tag_id = p.keep_id
FROM merge_pairs p WHERE f.tag_id = p.broken_id;

DELETE FROM tags t USING merge_pairs p WHERE t.id = p.broken_id;

SELECT
  b.pairs,
  b.rels_on_broken,
  b.filters_on_broken,
  b.tag_rels_total                                                    AS tag_rels_before,
  (SELECT count(*) FROM articles_rels WHERE tags_id IS NOT NULL)      AS tag_rels_after,
  b.tags_total                                                        AS tags_before,
  (SELECT count(*) FROM tags)                                         AS tags_after,
  (SELECT count(*) FROM tags WHERE slug ~ '\s' OR slug ~* '%[0-9a-f]{2}') AS still_broken,
  (SELECT count(*) FROM (
     SELECT parent_id, tags_id FROM articles_rels WHERE tags_id IS NOT NULL
     GROUP BY 1, 2 HAVING count(*) > 1) d)                            AS dup_article_tag_links
FROM merge_before b;

COMMIT;
