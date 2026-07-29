/**
 * ONE-TIME EMPIRICAL PROBE — Task 4 §1: does a field-level `beforeChange` hook fire for
 * a field nested inside a Lexical block, in the installed Payload version (3.84.0)?
 *
 * This is not an operational tool like the other scripts in this directory — it exists
 * to generate the stored-data evidence for a specific, one-off architectural question,
 * and is safe to re-run (e.g. after a future Payload upgrade) to re-confirm the answer.
 *
 * What it does: creates one throwaway article whose `body` contains a `socialEmbed`
 * block with a deliberately messy `source` (tracking params, wrong-but-allowed host).
 * The `source` field's `beforeChange` hook (src/blocks/SocialEmbed.ts) is supposed to
 * normalise that to the canonical URL via `parseEmbed`. This script only WRITES and
 * prints the article id + the API's own return value — it deliberately does NOT read
 * the verdict back from that same API response, because a Payload API response can echo
 * a transformed value that was never actually persisted. The real verdict comes from a
 * separate raw SQL read of `articles_locales.body` (via the Neon MCP `run_sql` tool, or
 * any Postgres client) against the SAME throwaway branch, after this script has run.
 *
 * SAFETY: reads DATABASE_URL from the environment exactly like every other script here
 * (see normalize-redirects.ts). Never edits .env. Run it with an explicit override so it
 * can never touch production:
 *
 *   DATABASE_URL="<throwaway-branch-connection-string>" pnpm tsx scripts/probe-block-hook.ts
 *
 * GUARD (fix round 1, Finding 2): this script calls payload.create() — a real write.
 * Without the override above, dotenv falls through to .env's connection string, which
 * points at PRODUCTION, and this script would write a genuine draft article there.
 * Disclosing that risk is not the same as closing it, so `assertNotProduction()` below
 * refuses to run — before Payload or the DB adapter are even loaded — unless the
 * resolved DATABASE_URL demonstrably does NOT resolve to the production endpoint.
 */

// Must precede the @payload-config import — see normalize-redirects.ts.
import "dotenv/config";

// Production's Neon compute endpoint id (project broad-snow-50246164, branch
// br-royal-wildflower-a21skzaw — "production", primary + default; see CLAUDE.md and
// scripts/backfill-wp-post-id.ts's own note on this branch). Stable identifying part of
// the host Neon assigns to the compute; the pooler suffix / region around it is not
// what's checked, so this doesn't rot if either of those changes.
const PRODUCTION_ENDPOINT_ID = "ep-rough-moon-a2j3hgj8";

/**
 * Refuses to proceed unless DATABASE_URL is set and demonstrably not production.
 * Runs before ANYTHING else in this script — before `payload` or `@payload-config` are
 * even imported (both are dynamic imports below, specifically so nothing Payload- or
 * DB-related loads before this check has already passed). Checked as a plain substring
 * on the raw connection string, not only on a `new URL()`-parsed hostname, so the guard
 * still holds even if DATABASE_URL is shaped in a way the URL parser doesn't like — a
 * guard that only works when parsing succeeds is not a guard.
 */
function assertNotProduction(rawDatabaseUrl: string | undefined): void {
  if (!rawDatabaseUrl) {
    console.error("DATABASE_URL is not set. Refusing to run without an explicit connection string.");
    process.exit(1);
  }

  let displayHost = "(could not parse DATABASE_URL as a URL)";
  try {
    displayHost = new URL(rawDatabaseUrl).host;
  } catch {
    // Parsing is only for the printout below; the safety check itself does not depend
    // on it succeeding (see the substring check further down).
  }
  console.log(`This script is about to write to: ${displayHost}`);

  if (rawDatabaseUrl.includes(PRODUCTION_ENDPOINT_ID)) {
    console.error(
      `\nREFUSING TO RUN: DATABASE_URL resolves to production (endpoint id ` +
        `${PRODUCTION_ENDPOINT_ID}, branch br-royal-wildflower-a21skzaw). This script ` +
        `calls payload.create() and must only ever run against a throwaway Neon branch.\n\n` +
        `Pass an explicit override:\n` +
        `  DATABASE_URL="<throwaway-branch-connection-string>" pnpm tsx scripts/probe-block-hook.ts\n`,
    );
    process.exit(1);
  }
}

assertNotProduction(process.env.DATABASE_URL);

// Deliberately messy: tracking params (?s=20&t=abc) AND the twitter.com host, which
// parseEmbed resolves but does not treat as canonical — the canonical form uses x.com
// with the tracking params stripped. If the stored value equals MESSY_SOURCE verbatim,
// the hook did not fire. If it equals CANONICAL_SOURCE, it did.
const MESSY_SOURCE = "https://twitter.com/MFMSport/status/1234567890123456789?s=20&t=abc";
const CANONICAL_SOURCE = "https://x.com/MFMSport/status/1234567890123456789";
const PROBE_BLOCK_ID = "probe4b1e0ck00000000000001";

async function main() {
  // Dynamic imports, not static ones: this guarantees nothing Payload- or DB-related is
  // even loaded until after assertNotProduction() above has already run and passed.
  const { getPayload } = await import("payload");
  const { default: config } = await import("@payload-config");

  const payload = await getPayload({ config });

  const body = {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: null,
      children: [
        {
          type: "paragraph",
          format: "",
          indent: 0,
          version: 1,
          direction: null,
          textStyle: "",
          textFormat: 0,
          children: [
            {
              mode: "normal",
              text: "PROBE ARTICLE — Task 4 §1 mechanism experiment. Safe to delete.",
              type: "text",
              style: "",
              detail: 0,
              format: 0,
              version: 1,
            },
          ],
        },
        {
          type: "block",
          format: "",
          version: 2,
          fields: {
            id: PROBE_BLOCK_ID,
            blockName: "",
            blockType: "socialEmbed",
            source: MESSY_SOURCE,
            caption: "PROBE caption",
          },
        },
      ],
    },
  };

  const created = await payload.create({
    collection: "articles",
    data: {
      title: "PROBE — Task 4 lexical block hook experiment (safe to delete)",
      slug: `probe-task-4-lexical-block-hook-${Date.now()}`,
      excerpt: "Throwaway probe article for Task 4 §1. Not real content.",
      body: body as never,
      author: 3,
      status: "draft",
    },
    locale: "ar",
    context: { disableRevalidate: true },
  });

  console.log("=== Task 4 §1 mechanism probe ===");
  console.log(`Created article id: ${created.id}`);
  console.log(`MESSY_SOURCE (what was written):     ${MESSY_SOURCE}`);
  console.log(`CANONICAL_SOURCE (hook should yield): ${CANONICAL_SOURCE}`);
  console.log();
  console.log("API response's own view of the block (NOT the verdict — see file header):");
  const blockFromApiResponse = ((created.body as { root?: { children?: unknown[] } })?.root?.children ?? []).find(
    (node): node is { fields?: { source?: unknown } } =>
      typeof node === "object" && node !== null && (node as { blockType?: unknown }).blockType === undefined && (node as { fields?: { blockType?: unknown } }).fields?.blockType === "socialEmbed",
  );
  console.log(JSON.stringify(blockFromApiResponse, null, 2));
  console.log();
  console.log("Next step: read articles_locales.body back from the database directly, e.g.:");
  console.log(
    `  SELECT jsonb_path_query(body, '$.root.children[*] ? (@.type == "block").fields.source') FROM articles_locales WHERE _parent_id = ${created.id} AND _locale = 'ar';`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
