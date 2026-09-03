# Changing the league the site features

The site used to hardcode the FIFA World Cup (API-Football league `1`, season
`2026`) in five places. It no longer does. Which league appears — in the hero
matches panel, the leagues carousel, the news-filter pills and the article-page
sidebar calendar — is now entirely a CMS decision, and the *season* is resolved
from API-Football's own `current` flag rather than pinned to a year.

This document is the operator's guide: how to switch leagues, and the DDL that
must be applied before the code goes live.

---

## 1. DDL — apply BEFORE deploying

`src/migrations` is gitignored and `payload migrate` warns of data loss on this
database (it detects dev-push drift), so these statements are applied by hand,
same as the archive-import DDL.

**First, confirm the naming convention on the live schema.** Payload derives
column names from field paths, and the statements below assume the same
convention the existing `heroMatches.competition` field produced. Print it:

```sql
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'homepage'
 ORDER BY ordinal_position;

SELECT conname
  FROM pg_constraint
 WHERE conrelid = 'homepage'::regclass AND contype = 'f';
```

You should see `hero_matches_competition_id` and its FK constraint. If the real
names differ from the pattern below, mirror the *live* names — do not apply
these verbatim.

```sql
-- Competitions: display order. Lower sorts first; 100 is the default so every
-- existing row keeps its current relative position until someone ranks them.
ALTER TABLE "competitions"
  ADD COLUMN IF NOT EXISTS "display_order" numeric DEFAULT 100;

-- Homepage global: the article-page matches sidebar.
ALTER TABLE "homepage"
  ADD COLUMN IF NOT EXISTS "article_matches_enabled" boolean DEFAULT true;
ALTER TABLE "homepage"
  ADD COLUMN IF NOT EXISTS "article_matches_competition_id" integer;

ALTER TABLE "homepage"
  ADD CONSTRAINT "homepage_article_matches_competition_id_competitions_id_fk"
  FOREIGN KEY ("article_matches_competition_id")
  REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "homepage_article_matches_competition_idx"
  ON "homepage" USING btree ("article_matches_competition_id");
```

Rollback:

```sql
ALTER TABLE "homepage" DROP COLUMN "article_matches_competition_id";
ALTER TABLE "homepage" DROP COLUMN "article_matches_enabled";
ALTER TABLE "competitions" DROP COLUMN "display_order";
```

---

## 2. Switching the featured league

All of this is admin UI. None of it is a deploy.

**Rank the competitions.** *Competitions* → set **Display order** on each. The
league currently in season gets `0`. This one field drives:

- the order of the homepage leagues carousel,
- the order of the news-by-league pills (when Homepage Settings has no explicit
  filter list), and
- **the default competition** — used anywhere no competition is chosen
  explicitly.

So in the common case, ranking the in-season league `0` is the entire job.

**Override a specific surface.** *Homepage Settings* → pick a competition under:

| Field | Controls |
|---|---|
| Hero matches panel → Competition | The big panel beside the hero slider. Its group also starts expanded. |
| Lower matches section → Source / Competition | The matches strip further down. `Today's matches` spans all listed leagues. |
| Article page — matches sidebar → Competition | The calendar in the right rail of every article. Its heading is the competition's localized name. |

Each falls back to the default competition when left empty. The article sidebar
also has a **Show the calendar** checkbox to drop the card entirely.

**Seasons look after themselves.** Nothing above asks for a year. Each
competition's `season` field is now only the *fallback* used when API-Football is
unreachable; normally the season flagged `current` upstream wins, so a league
rolls into its new season with no edit.

**Custom crests.** A competition's `Logo URL` (or uploaded `Logo`) overrides
API-Football's crest everywhere, including in fixture groupings that come from
upstream data. The World Cup's 2026 emblem is now just a `logoUrl` on that row
(`/images/world-cup-2026.png`) rather than a special case in code — set it there
if it is not already.

---

## 3. Verifying — on the served bytes

Per `docs/verification-principles.md`, a green build proves nothing here. After
deploying and editing:

```bash
# The hero panel's league heading should be the competition you featured.
curl -s https://www.mfmsport.ma/ar | grep -o 'data-leagues-slider' | wc -l

# The article sidebar heading should be the competition's Arabic name, and
# "مونديال 2026" should appear nowhere unless you deliberately featured it.
curl -s "https://www.mfmsport.ma/ar/articles/<some-slug>" | grep -o 'مونديال 2026' | wc -l
```

`grep -c` counts matching *lines* and the HTML is minified to one line — use
`grep -o | wc -l`, as above.

Caching to expect: the homepage is ISR at 300s, and both the Homepage global and
the Competitions collection bust it on write (`SETTINGS_TAG` plus the
`/{locale}` paths), so an edit should show up immediately rather than after the
TTL. Fixture data itself is cached 900s upstream of that.

---

## 4. What this replaced

`src/lib/api-football/worldcup.ts` is deleted. Its four exports had these fates:

| Was | Now |
|---|---|
| `WORLD_CUP_LEAGUE_ID` / `WORLD_CUP_SEASON` | `CompetitionRef` from the Competitions collection; season via `getCurrentSeason` |
| `WORLD_CUP_LOGO` | the competition's `logoUrl` field |
| `getAllWorldCupFixtures()` | `getCompetitionFixtures(comp)` |
| `getWorldCupFixtures()` | `getCompetitionFixtures(comp, { next: 50 })` |

The "chosen, else default" rule lives in exactly one place —
`resolveFeaturedCompetition()` in `src/lib/home/competitionOrder.ts` — shared by
the homepage and the article page, so the two cannot drift apart.
