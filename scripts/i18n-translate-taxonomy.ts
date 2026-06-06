/**
 * MFM Sport — Taxonomy & Author i18n
 *   pnpm i18n:taxonomy:export    # distinct AR names -> translations/taxonomy.json (fr/en empty)
 *   pnpm i18n:taxonomy           # filled taxonomy.json -> update fr/en
 *   pnpm i18n:taxonomy:dry
 * Keep "slug" unchanged; fill "fr"/"en" (and author bioFr/bioEn). Keyed by slug, idempotent.
 * Requires DATABASE_URL, PAYLOAD_SECRET.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getPayload } from "payload";
import config from "../src/payload.config";

function parseArgs(argv: string[]) {
  let mode: "export" | "import" = "import", dryRun = false;
  for (const arg of argv) {
    if (arg === "--export") mode = "export";
    else if (arg === "--import") mode = "import";
    else if (arg === "--dry-run") dryRun = true;
  }
  return { mode, dryRun };
}
const { mode: MODE, dryRun: DRY_RUN } = parseArgs(process.argv.slice(2));
const FILE = path.join(process.cwd(), "translations", "taxonomy.json");
const PAGE_SIZE = 200;
const log = (m: string) => console.log(m);
type Term = { slug: string; ar: string; fr: string; en: string };
type Author = { slug: string; ar: string; fr: string; en: string; bioAr: string; bioFr: string; bioEn: string };
type TaxFile = { categories: Term[]; tags: Term[]; authors: Author[] };

async function collectTerms(payload: any, collection: "categories" | "tags"): Promise<Term[]> {
  const out: Term[] = []; let page = 1, hasMore = true;
  while (hasMore) {
    const res = await payload.find({ collection, locale: "ar", page, limit: PAGE_SIZE, depth: 0, sort: "slug", overrideAccess: true });
    for (const d of res.docs) out.push({ slug: String(d.slug), ar: String(d.name ?? ""), fr: "", en: "" });
    hasMore = page < res.totalPages; page++;
  }
  return out;
}
async function collectAuthors(payload: any): Promise<Author[]> {
  const out: Author[] = []; let page = 1, hasMore = true;
  while (hasMore) {
    const res = await payload.find({ collection: "authors", locale: "ar", page, limit: PAGE_SIZE, depth: 0, sort: "slug", overrideAccess: true });
    for (const d of res.docs) out.push({ slug: String(d.slug), ar: String(d.name ?? ""), fr: "", en: "", bioAr: String(d.bio ?? ""), bioFr: "", bioEn: "" });
    hasMore = page < res.totalPages; page++;
  }
  return out;
}
async function findIdBySlug(payload: any, collection: "categories" | "tags" | "authors", slug: string) {
  const res = await payload.find({ collection, where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true });
  return res.docs[0]?.id ?? null;
}
async function runExport(payload: any) {
  const data: TaxFile = { categories: await collectTerms(payload, "categories"), tags: await collectTerms(payload, "tags"), authors: await collectAuthors(payload) };
  if (DRY_RUN) { log(`  [dry] categories=${data.categories.length} tags=${data.tags.length} authors=${data.authors.length}`); return; }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  log(`  [export] ${FILE} (categories=${data.categories.length} tags=${data.tags.length} authors=${data.authors.length})`);
}
async function runImport(payload: any) {
  if (!fs.existsSync(FILE)) { console.error(`  [error] ${FILE} not found. Run i18n:taxonomy:export first.`); process.exit(1); }
  const data: TaxFile = JSON.parse(fs.readFileSync(FILE, "utf8"));
  let updated = 0, skipped = 0;
  for (const collection of ["categories", "tags"] as const) {
    for (const term of data[collection]) {
      if (!term.fr?.trim() || !term.en?.trim()) { skipped++; continue; }
      const id = await findIdBySlug(payload, collection, term.slug);
      if (!id) { skipped++; console.error(`  [missing] ${collection} "${term.slug}"`); continue; }
      if (DRY_RUN) { log(`  [dry-update] ${collection} ${term.slug}: fr="${term.fr}" en="${term.en}"`); continue; }
      await payload.update({ collection, id, data: { name: term.fr }, locale: "fr", overrideAccess: true });
      await payload.update({ collection, id, data: { name: term.en }, locale: "en", overrideAccess: true });
      updated++; log(`  [updated fr+en] ${collection} ${term.slug}`);
    }
  }
  for (const a of data.authors) {
    if (!a.fr?.trim() || !a.en?.trim()) { skipped++; continue; }
    const id = await findIdBySlug(payload, "authors", a.slug);
    if (!id) { skipped++; console.error(`  [missing] authors "${a.slug}"`); continue; }
    if (DRY_RUN) { log(`  [dry-update] authors ${a.slug}: fr="${a.fr}" en="${a.en}"`); continue; }
    // Only include `bio` when the translator actually provided one, so an empty
    // bioFr/bioEn never blanks an existing bio set elsewhere (e.g. in the admin).
    const frData: Record<string, string> = { name: a.fr };
    if (a.bioFr?.trim()) frData.bio = a.bioFr;
    const enData: Record<string, string> = { name: a.en };
    if (a.bioEn?.trim()) enData.bio = a.bioEn;
    await payload.update({ collection: "authors", id, data: frData, locale: "fr", overrideAccess: true });
    await payload.update({ collection: "authors", id, data: enData, locale: "en", overrideAccess: true });
    updated++; log(`  [updated fr+en] authors ${a.slug}`);
  }
  log(`\n=== Taxonomy Import Complete ===\nUpdated: ${updated}  Skipped: ${skipped}`);
  if (DRY_RUN) log("(DRY RUN: nothing written)");
}
async function main() {
  log(`=== MFM Sport Taxonomy i18n ===  mode: ${MODE} ${DRY_RUN ? "(DRY RUN)" : ""}`);
  const payload = await getPayload({ config });
  if (MODE === "export") await runExport(payload); else await runImport(payload);
  process.exit(0);
}
main().catch((err) => { console.error("Taxonomy i18n failed:", err); process.exit(1); });
