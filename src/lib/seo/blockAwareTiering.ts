/**
 * Block-aware tiering entry point for Lexical (Payload richText) article
 * bodies — the highest-consequence item in this batch, because
 * `archive-brief` is `noindex`, permanently.
 *
 * `tierFor(textLength)` in `wpArchive.ts` is deliberately UNCHANGED: it is
 * verified working over 8,542 imported articles and remains the entry point
 * for the raw-HTML import path (`scripts/import-wp-archive.ts`). This module
 * adds a second, Lexical-aware entry point ALONGSIDE it rather than rewriting
 * that signature.
 *
 * Exposure, established empirically (see task-567-report.md for the call-site
 * evidence): today, `tierFor` is called from exactly one place
 * (`scripts/import-wp-archive.ts:367`), operating on raw WordPress HTML
 * strings. Admin-authored (Lexical-bodied) articles get `seoTier: "editorial"`
 * by default (`src/collections/Articles.ts`) and no hook or code path ever
 * recomputes it. So the "a gallery/embed-only article gets silently tiered to
 * noindex" failure mode is currently LATENT, not active — this module is
 * protection against a future bulk re-tier tool, not a fix for a live bug.
 * Built regardless, per the brief: build it either way, only the description
 * of urgency changes.
 */

import { tierFor } from "./wpArchive";
import { extractPlainText, hasMediaBlock } from "@/lib/richtext/extractPlainText";

/**
 * Block-aware replacement for measuring-then-tiering a Lexical article body.
 *
 * 1. Length is measured via the Task 6 extractor, so a body built from blocks
 *    (an embed, a gallery, an audio segment) scores real content instead of
 *    zero — captions and alt text count toward that length, because they are
 *    real editorial text, not decoration.
 * 2. Any article containing at least one media block (`socialEmbed`,
 *    `gallery`, `audio`, `embedFrame`, or a bare inline upload/image node) is
 *    ineligible for `archive-brief` regardless of text length: a match report
 *    built around a video embed and 300 words of Arabic is not "brief" just
 *    because the embed itself contributes little extracted text.
 * 3. Otherwise, defers to the SAME threshold decision as the raw-HTML path
 *    (`tierFor`), so the two paths agree on what "enough text" means.
 */
export function tierForLexicalBody(content: unknown): "archive-full" | "archive-brief" {
  if (hasMediaBlock(content)) return "archive-full";
  return tierFor(extractPlainText(content).length);
}
