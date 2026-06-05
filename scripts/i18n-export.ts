/**
 * MFM Sport — i18n Export (Arabic → translation work files)
 *   pnpm i18n:export                       # all published AR articles
 *   pnpm i18n:export -- --limit=10         # PILOT: first 10
 *   pnpm i18n:export -- --limit=10 --offset=10
 *   pnpm i18n:export -- --dry-run
 * Output: translations/pending/<id>.json (one per article). Skips any id already
 * present in translations/done/ so in-progress work is never clobbered.
 * Requires: DATABASE_URL, PAYLOAD_SECRET in .env
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getPayload } from "payload";
import config from "../src/payload.config";
import { extractSegments } from "../src/lib/i18n/lexical-translate";

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
const PENDING_DIR = path.join(ROOT, "translations", "pending");
const DONE_DIR = path.join(ROOT, "translations", "done");
const SCHEMA_VERSION = 1, PAGE_SIZE = 100;
type Seg = { id: string; text: string };
const log = (m: string) => console.log(m);

function relName(name: unknown): string | null {
  if (name && typeof name === "object" && "name" in (name as any)) {
    return String((name as any).name ?? "").trim() || null;
  }
  return null;
}
function emptyTarget(segments: Seg[]) {
  return { title: "", excerpt: "", slug: "", bodySegments: segments.map((s) => ({ id: s.id, text: "" })) };
}
function doneIds(): Set<string> {
  if (!fs.existsSync(DONE_DIR)) return new Set();
  return new Set(fs.readdirSync(DONE_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")));
}

async function main() {
  log("=== MFM Sport i18n Export ===");
  log(`mode: ${DRY_RUN ? "DRY RUN" : "WRITE"}  limit: ${LIMIT ?? "none"}  offset: ${OFFSET}`);
  if (!DRY_RUN) fs.mkdirSync(PENDING_DIR, { recursive: true });

  const payload = await getPayload({ config });
  const already = doneIds();
  let written = 0, skippedDone = 0, processed = 0, globalSeen = 0, page = 1, hasMore = true;

  while (hasMore) {
    const res = await payload.find({
      collection: "articles",
      where: { status: { equals: "published" } },
      locale: "ar", sort: "publishedAt", page, limit: PAGE_SIZE, depth: 1, overrideAccess: true,
    });
    for (const art of res.docs) {
      if (globalSeen < OFFSET) { globalSeen++; continue; }
      globalSeen++;
      const id = String(art.id);
      // Already-translated articles never count toward --limit, so an incremental
      // re-run with --limit=N reliably exports N NEW work files.
      if (already.has(id)) { skippedDone++; continue; }
      if (LIMIT !== null && processed >= LIMIT) { hasMore = false; break; }
      processed++;

      const segments: Seg[] = extractSegments((art as any).body);
      const fi = (art as any).featuredImage;
      const featuredImageId = fi && typeof fi === "object" ? fi.id : (fi ?? null);

      const fileData = {
        schemaVersion: SCHEMA_VERSION, id, arSlug: String((art as any).slug ?? ""),
        source: { title: String((art as any).title ?? ""), excerpt: String((art as any).excerpt ?? "") },
        bodySegments: segments,
        meta: {
          categoryNames: ((art as any).categories ?? []).map(relName).filter(Boolean) as string[],
          tagNames: ((art as any).tags ?? []).map(relName).filter(Boolean) as string[],
          authorName: relName((art as any).author),
          publishedAt: (art as any).publishedAt ?? null,
          featuredImageId: featuredImageId ?? null,
        },
        target: { fr: emptyTarget(segments), en: emptyTarget(segments) },
      };

      if (DRY_RUN) {
        log(`  [dry] ${id}  "${fileData.source.title}"  segments=${segments.length}`);
      } else {
        const outPath = path.join(PENDING_DIR, `${id}.json`);
        fs.writeFileSync(outPath, JSON.stringify(fileData, null, 2), "utf8");
        written++; log(`  [export] ${outPath}  (${segments.length} segments)`);
      }
    }
    hasMore = hasMore && page < res.totalPages;
    page++;
  }
  log(`\n=== Export Complete ===\nFiles written: ${written}\nSkipped (already in done/): ${skippedDone}`);
  if (DRY_RUN) log("(DRY RUN: no files written)");
  process.exit(0);
}
main().catch((err) => { console.error("Export failed:", err); process.exit(1); });
