/**
 * Adjudicate a disagreement between two measurements of the same corpus.
 *
 * The importer tiers on `bodyTextLength(content) + stripToText(acfText)`, and
 * docs/wp-corpus-analysis.md reports a per-year "thin (<500 chars)" rate from an
 * ad-hoc measurement that shares no code with it. For 2024 they disagree: the
 * doc says 13.2% thin, the running import says ~21%.
 *
 * That corpus table has already been rebuilt once, after the CDATA stripper was
 * found to be deleting whole article bodies. A second disagreement between it
 * and the importer is far more likely to be a measurement bug than a real
 * property of 2024 — so this measures both, over the SAME posts, and prints the
 * shortest-scoring posts so the raw record can be read directly.
 *
 * It writes nothing. Tiering is a field update, so the import is not blocked on
 * the answer; this only decides which number to trust.
 *
 * Usage:
 *   pnpm audit:body-length --year=2024
 *   pnpm audit:body-length --year=2024 --samples=10
 */

import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bodyTextLength, resolvePublishedAt, stripToText, ACF_BODY_KEY } from "../src/lib/seo/wpArchive";

const argv = process.argv.slice(2);
const val = (n: string, d?: string) =>
  argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;

const YEAR = val("year", "2024")!;
const SAMPLES = Number(val("samples", "10"));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XML_PATH =
  val("file") ?? path.resolve(__dirname, "..", "mfmsport.WordPress.2026-04-24.xml");

function readTag(line: string, tag: string): string | null {
  const m = line.match(
    new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`),
  );
  return m ? m[1] : null;
}

/** Everything inside <content:encoded>, tags and CDATA removed. Multi-line safe. */
function plainFromBlock(block: string): string {
  return stripToText(block.replace(/<\/?content:encoded>/g, ""));
}

type Sample = { id: number; slug: string; importer: number; plain: number; rawChars: number };

async function main() {
  const rl = readline.createInterface({
    input: fs.createReadStream(XML_PATH, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let inItem = false, inContent = false, inExcerpt = false;
  let id: number | null = null;
  let slug = "", type = "", status = "", date = "", dateGmt = "", modified = "";
  let content = "", excerpt = "", acf = "";
  let lastMetaKey: string | null = null;
  let multilineMetaValues = 0;

  let n = 0, thinImporter = 0, thinPlain = 0, disagree = 0;
  const samples: Sample[] = [];

  for await (const line of rl) {
    if (line.includes("<item>")) {
      inItem = true; inContent = false; inExcerpt = false;
      id = null; slug = ""; type = ""; status = ""; date = ""; dateGmt = ""; modified = "";
      content = ""; excerpt = ""; acf = ""; lastMetaKey = null;
      continue;
    }
    if (!inItem) continue;

    if (line.includes("</item>")) {
      inItem = false;
      if (type === "post" && status === "publish" && id !== null) {
        const iso = resolvePublishedAt(date, dateGmt, modified);
        if (iso && iso.slice(0, 4) === YEAR) {
          n++;
          // Exactly what the importer computes.
          const importer = bodyTextLength(content) + stripToText(acf).length;
          // An independent measure of the same body, multi-line safe.
          const plain = plainFromBlock(content).length;

          if (importer < 500) thinImporter++;
          if (plain < 500) thinPlain++;
          if ((importer < 500) !== (plain < 500)) disagree++;

          if (importer < 500 && samples.length < SAMPLES) {
            samples.push({ id, slug, importer, plain, rawChars: content.length });
          }
        }
      }
      continue;
    }

    if (id === null && line.includes("<wp:post_id>")) {
      const v = readTag(line, "wp:post_id"); id = v ? Number(v) : null;
    }
    if (!type && line.includes("<wp:post_type>")) type = readTag(line, "wp:post_type") ?? "";
    if (!status && line.includes("<wp:status>")) status = readTag(line, "wp:status") ?? "";
    if (!slug && line.includes("<wp:post_name>")) slug = readTag(line, "wp:post_name") ?? "";
    if (!date && line.includes("<wp:post_date>")) date = readTag(line, "wp:post_date") ?? "";
    if (!dateGmt && line.includes("<wp:post_date_gmt>")) dateGmt = readTag(line, "wp:post_date_gmt") ?? "";
    if (!modified && line.includes("<wp:post_modified>")) modified = readTag(line, "wp:post_modified") ?? "";

    if (line.includes("<content:encoded>")) inContent = true;
    if (inContent) content += line + "\n";
    if (line.includes("</content:encoded>")) inContent = false;

    if (line.includes("<excerpt:encoded>")) inExcerpt = true;
    if (inExcerpt) excerpt += line + "\n";
    if (line.includes("</excerpt:encoded>")) inExcerpt = false;

    // Mirror the importer's ACF handling, and count how often its single-line
    // assumption is violated — that is the failure mode under suspicion.
    if (line.includes("<wp:meta_key>")) lastMetaKey = readTag(line, "wp:meta_key");
    if (line.includes("<wp:meta_value>") && lastMetaKey) {
      if (ACF_BODY_KEY.test(lastMetaKey)) {
        const v = readTag(line, "wp:meta_value");
        if (v === null && !line.includes("</wp:meta_value>")) multilineMetaValues++;
        acf += " " + stripToText(v ?? "");
      }
      lastMetaKey = null;
    }
  }
  rl.close();

  const pct = (x: number) => ((x / n) * 100).toFixed(1);
  console.log(`\n=== Body-length audit — ${YEAR} ===`);
  console.log(`published posts:            ${n}`);
  console.log(`thin (<500) per importer:   ${thinImporter}  (${pct(thinImporter)}%)`);
  console.log(`thin (<500) per plain text: ${thinPlain}  (${pct(thinPlain)}%)`);
  console.log(`posts where they disagree:  ${disagree}`);
  console.log(`multi-line ACF meta_values: ${multilineMetaValues}`);

  console.log(`\nshortest posts as scored by the importer:`);
  console.log(`  ${"wp_id".padEnd(9)}${"importer".padStart(10)}${"plain".padStart(8)}${"rawHTML".padStart(9)}  slug`);
  for (const s of samples) {
    console.log(
      `  ${String(s.id).padEnd(9)}${String(s.importer).padStart(10)}${String(s.plain).padStart(8)}` +
        `${String(s.rawChars).padStart(9)}  ${s.slug.slice(0, 46)}`,
    );
  }
  console.log();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
