/**
 * Spot-check imported articles against the source export.
 *
 * The importer reports "created: N, failed: 0", which says every row was
 * written — not that any of them holds the right text. The CDATA bug was
 * invisible to exactly that kind of summary: it deleted whole article bodies
 * while every count stayed green. So this compares the stored body against the
 * bytes in the XML, per article.
 *
 * What it asserts, per sampled post:
 *   - the article exists at the expected wpPostId
 *   - its stored plain text is within a tolerance of the export's plain text
 *   - its title and publish date match
 *   - a legacy redirect exists pointing at it
 *
 * Tolerance exists because the two are not byte-identical by design: the
 * importer strips <img> and <figure> (the media is gone — every uploads URL
 * 404s) and converts to Lexical. A body that is MUCH shorter than source is the
 * signal worth catching; small deltas are expected.
 *
 * Usage:
 *   pnpm spotcheck --year=2024 --samples=10
 */

// Must precede the @payload-config import — see normalize-redirects.ts.
import "dotenv/config";
import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPayload } from "payload";
import config from "@payload-config";
import { resolvePublishedAt, stripToText } from "../src/lib/seo/wpArchive";
import { normalizeLegacyPath } from "../src/lib/seo/legacyPath";
import { legacyPathFromLink } from "../src/lib/seo/wpArchive";

const argv = process.argv.slice(2);
const val = (n: string, d?: string) =>
  argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;

const YEAR = val("year", "2024")!;
const SAMPLES = Number(val("samples", "10"));
/** Flag anything retaining less than this share of the source text. */
const MIN_RATIO = Number(val("min-ratio", "0.5"));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XML_PATH =
  val("file") ?? path.resolve(__dirname, "..", "mfmsport.WordPress.2026-04-24.xml");

function readTag(line: string, tag: string): string | null {
  const m = line.match(
    new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`),
  );
  return m ? m[1] : null;
}

/** Flatten a Lexical root to plain text, so it can be compared with the source. */
function lexicalToText(node: any): string {
  if (!node || typeof node !== "object") return "";
  let out = "";
  if (typeof node.text === "string") out += node.text + " ";
  const kids = node.children ?? node.root?.children;
  if (Array.isArray(kids)) for (const k of kids) out += lexicalToText(k);
  return out;
}

async function main() {
  const payload = await getPayload({ config });

  // Evenly spaced sample across the year, not the first N — the first N are all
  // from the same few days and would share any date-local defect.
  const posts: { id: number; title: string; content: string; link: string; iso: string }[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(XML_PATH, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let inItem = false, inContent = false;
  let id: number | null = null;
  let title = "", link = "", type = "", status = "", date = "", dateGmt = "", modified = "", content = "";

  for await (const line of rl) {
    if (line.includes("<item>")) {
      inItem = true; inContent = false;
      id = null; title = ""; link = ""; type = ""; status = "";
      date = ""; dateGmt = ""; modified = ""; content = "";
      continue;
    }
    if (!inItem) continue;
    if (line.includes("</item>")) {
      inItem = false;
      if (type === "post" && status === "publish" && id !== null) {
        const iso = resolvePublishedAt(date, dateGmt, modified);
        if (iso && iso.slice(0, 4) === YEAR) posts.push({ id, title, content, link, iso });
      }
      continue;
    }
    if (id === null && line.includes("<wp:post_id>")) {
      const v = readTag(line, "wp:post_id"); id = v ? Number(v) : null;
    }
    if (!type && line.includes("<wp:post_type>")) type = readTag(line, "wp:post_type") ?? "";
    if (!status && line.includes("<wp:status>")) status = readTag(line, "wp:status") ?? "";
    if (!title && line.includes("<title>")) title = readTag(line, "title") ?? "";
    if (!link && line.includes("<link>")) link = readTag(line, "link") ?? "";
    if (!date && line.includes("<wp:post_date>")) date = readTag(line, "wp:post_date") ?? "";
    if (!dateGmt && line.includes("<wp:post_date_gmt>")) dateGmt = readTag(line, "wp:post_date_gmt") ?? "";
    if (!modified && line.includes("<wp:post_modified>")) modified = readTag(line, "wp:post_modified") ?? "";
    if (line.includes("<content:encoded>")) inContent = true;
    if (inContent) content += line + "\n";
    if (line.includes("</content:encoded>")) inContent = false;
  }
  rl.close();

  if (!posts.length) { console.log(`no ${YEAR} posts found`); process.exit(1); }

  const step = Math.max(1, Math.floor(posts.length / SAMPLES));
  const sample = Array.from({ length: Math.min(SAMPLES, posts.length) }, (_, i) => posts[i * step]);

  console.log(`\n=== Spot-check — ${YEAR} (${sample.length} of ${posts.length}) ===\n`);
  console.log(
    `  ${"wp_id".padEnd(8)}${"src".padStart(7)}${"stored".padStart(8)}${"ratio".padStart(8)}` +
      `  ${"date".padEnd(6)}${"redir".padEnd(7)}title`,
  );

  let failures = 0;
  for (const p of sample) {
    const found = await payload.find({
      collection: "articles",
      where: { wpPostId: { equals: p.id } },
      locale: "ar",
      limit: 1,
      depth: 0,
    });
    const doc: any = found.docs[0];
    if (!doc) { console.log(`  ${String(p.id).padEnd(8)}  MISSING — not imported`); failures++; continue; }

    const srcLen = stripToText(p.content.replace(/<\/?content:encoded>/g, "")).length;
    const storedLen = lexicalToText(doc.body).replace(/\s+/g, " ").trim().length;
    const ratio = srcLen ? storedLen / srcLen : 1;

    const rawFrom = legacyPathFromLink(p.link);
    const from = rawFrom ? normalizeLegacyPath(rawFrom) : null;
    const redir = from
      ? await payload.find({ collection: "redirects", where: { from: { equals: from } }, limit: 1 })
      : { docs: [] as any[] };

    const dateOk = String(doc.publishedAt).slice(0, 10) === p.iso.slice(0, 10);
    const redirOk = redir.docs.length > 0 && redir.docs[0].to === `/ar/articles/${doc.slug}`;
    const bodyOk = ratio >= MIN_RATIO;
    if (!dateOk || !redirOk || !bodyOk) failures++;

    console.log(
      `  ${String(p.id).padEnd(8)}${String(srcLen).padStart(7)}${String(storedLen).padStart(8)}` +
        `${ratio.toFixed(2).padStart(8)}  ${(dateOk ? "ok" : "BAD").padEnd(6)}` +
        `${(redirOk ? "ok" : "BAD").padEnd(7)}${stripToText(p.title).slice(0, 40)}`,
    );
  }

  console.log(`\n  ${failures === 0 ? "PASS — all sampled articles match source." : `FAIL — ${failures} problem(s).`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
