/**
 * MFM Sport — i18n Import (translated work files → Payload fr/en locales)
 *   pnpm i18n:import                 # import everything in done/
 *   pnpm i18n:import -- --limit=10   # PILOT
 *   pnpm i18n:import -- --dry-run    # validate only, write nothing
 * Reinjects translated text into the ORIGINAL Arabic Lexical tree (media/upload
 * nodes pass through untouched), flips direction to ltr, writes fr+en. Never
 * writes ar. Idempotent (full per-locale overwrite). Requires DATABASE_URL, PAYLOAD_SECRET.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getPayload } from "payload";
import config from "../src/payload.config";
import { extractSegments, buildTranslatedBody } from "../src/lib/i18n/lexical-translate";
import { slugify, slugifyWithFallback } from "../src/lib/payload/slugify";

function parseArgs(argv: string[]) {
  let limit: number | null = null, offset = 0, dryRun = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--limit=")) limit = parseInt(arg.slice(8), 10);
    else if (arg.startsWith("--offset=")) offset = parseInt(arg.slice(9), 10);
  }
  return { limit, offset, dryRun };
}
const { limit: LIMIT, offset: OFFSET, dryRun: DRY_RUN } = parseArgs(process.argv.slice(2));
const ROOT = process.cwd();
const DONE_DIR = path.join(ROOT, "translations", "done");
const LANGS = ["fr", "en"] as const;
type Lang = (typeof LANGS)[number];
type Seg = { id: string; text: string };
const log = (m: string) => console.log(m);

function validateFile(data: any): string[] {
  const errs: string[] = [];
  if (data?.schemaVersion !== 1) errs.push(`schemaVersion != 1`);
  if (!data?.id) errs.push(`missing id`);
  if (!Array.isArray(data?.bodySegments)) { errs.push(`missing source bodySegments`); return errs; }
  const sourceIds = data.bodySegments.map((s: Seg) => s.id);
  const sourceIdSet = new Set(sourceIds);
  for (const lang of LANGS) {
    const t = data?.target?.[lang];
    if (!t) { errs.push(`[${lang}] missing target block`); continue; }
    if (!t.title || !String(t.title).trim()) errs.push(`[${lang}] empty title`);
    if (!t.excerpt || !String(t.excerpt).trim()) errs.push(`[${lang}] empty excerpt`);
    if (!t.slug || !String(t.slug).trim()) errs.push(`[${lang}] empty slug`);
    const segs: Seg[] = Array.isArray(t.bodySegments) ? t.bodySegments : [];
    if (segs.length !== sourceIds.length) errs.push(`[${lang}] segment count ${segs.length} != source ${sourceIds.length}`);
    const seen = new Set<string>();
    for (const s of segs) {
      if (!sourceIdSet.has(s.id)) errs.push(`[${lang}] unknown segment id "${s.id}"`);
      if (seen.has(s.id)) errs.push(`[${lang}] duplicate segment id "${s.id}"`);
      seen.add(s.id);
      if (!s.text || !String(s.text).trim()) errs.push(`[${lang}] empty text for "${s.id}"`);
    }
    for (const id of sourceIds) if (!seen.has(id)) errs.push(`[${lang}] missing segment id "${id}"`);
  }
  return errs;
}

/** Per-locale unique slug: append -2, -3, ... on collision with another article. */
async function uniqueLocalizedSlug(payload: any, base: string, locale: Lang, selfId: string | number): Promise<string> {
  let candidate = base, n = 1;
  while (n < 50) {
    const clash = await payload.find({
      collection: "articles",
      where: { slug: { equals: candidate }, id: { not_equals: selfId } },
      locale, limit: 1, depth: 0, overrideAccess: true,
    });
    if (!clash.docs[0]) return candidate;
    n += 1; candidate = `${base}-${n}`;
  }
  return `${base}-${selfId}`;
}

async function main() {
  log("=== MFM Sport i18n Import ===");
  log(`mode: ${DRY_RUN ? "DRY RUN" : "WRITE"}  limit: ${LIMIT ?? "none"}  offset: ${OFFSET}`);
  if (!fs.existsSync(DONE_DIR)) { log(`No done/ directory at ${DONE_DIR} — nothing to import.`); process.exit(0); }

  const payload = await getPayload({ config });

  // PREREQUISITE GUARD: this script writes a per-locale slug. If `slug` is not a
  // localized field yet (Phase A1 + the slug migration not applied), a
  // locale-scoped write would clobber the single shared Arabic slug — silent,
  // irreversible data loss. Refuse to run until slug is localized.
  const slugField = (payload.collections.articles.config.fields as any[]).find(
    (f) => f && f.name === "slug",
  );
  if (!slugField?.localized) {
    console.error(
      "[abort] articles.slug is not localized yet. Complete Phase A (make slug " +
        "localized + run the slug migration) before importing translations. " +
        "No writes performed.",
    );
    process.exit(1);
  }

  const files = fs.readdirSync(DONE_DIR).filter((f) => f.endsWith(".json")).sort()
    .slice(OFFSET, LIMIT !== null ? OFFSET + LIMIT : undefined);

  let imported = 0, invalid = 0, missing = 0, failed = 0;
  for (const file of files) {
    try {
      const filePath = path.join(DONE_DIR, file);
      let data: any;
      try { data = JSON.parse(fs.readFileSync(filePath, "utf8")); }
      catch (err: any) { invalid++; console.error(`  [parse-fail] ${file}: ${err.message}`); continue; }

      const problems = validateFile(data);
      if (problems.length) { invalid++; console.error(`  [invalid] ${file}:\n    - ${problems.join("\n    - ")}`); continue; }

      const id = data.id as string | number;
      const arDoc = await payload.findByID({ collection: "articles", id, locale: "ar", depth: 0, overrideAccess: true });
      if (!arDoc) { missing++; console.error(`  [missing] article id ${id} (file ${file})`); continue; }

      // Re-check the file's source ids still match the live AR body.
      const liveSegIds = extractSegments((arDoc as any).body).map((s) => s.id);
      const fileSegIds = data.bodySegments.map((s: Seg) => s.id);
      if (liveSegIds.join("|") !== fileSegIds.join("|")) {
        invalid++; console.error(`  [stale] ${file}: AR body changed since export. Re-export this article.`); continue;
      }

      for (const lang of LANGS) {
        const t = data.target[lang];
        const translatedById: Record<string, string> = {};
        for (const s of t.bodySegments as Seg[]) translatedById[s.id] = s.text;

        // reinject -> validateReinjection (structure unchanged) -> setDirection ltr.
        const body = buildTranslatedBody((arDoc as any).body, translatedById, "ltr");

        const base = slugifyWithFallback(slugify(t.slug) || t.title, String(id));
        const slug = await uniqueLocalizedSlug(payload, base, lang, id);

        if (DRY_RUN) { log(`  [dry-update] id=${id} ${lang} slug=${slug} title="${t.title}"`); continue; }

        await payload.update({
          collection: "articles", id, locale: lang,
          // body is a validated LexicalRoot; its `format: string` is wider than
          // Payload's generated union but identical at runtime (consistent with
          // the `(arDoc as any).body` reads above).
          data: { title: t.title, excerpt: t.excerpt, slug, body: body as any },
          overrideAccess: true,
        });
        log(`  [updated ${lang}] id=${id} slug=${slug}`);
      }
      imported++;
    } catch (err: any) {
      // One bad article must not abort a 200-article bulk run.
      failed++;
      console.error(`  [error] ${file}: ${err?.message ?? err}`);
    }
  }
  log(`\n=== Import Complete ===\nArticles imported: ${imported}\nInvalid/skipped: ${invalid}\nMissing: ${missing}\nErrored: ${failed}`);
  if (DRY_RUN) log("(DRY RUN: nothing written)");
  process.exit(0);
}
main().catch((err) => { console.error("Import failed:", err); process.exit(1); });
