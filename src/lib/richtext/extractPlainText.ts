/**
 * Text-only extraction from a Lexical (Payload richText) body: meta
 * descriptions, excerpts, RSS and search indexing all want plain text, not
 * JSX. Walks the same tree the JSX converters (`richTextConverters.tsx`) walk,
 * but returns a string instead of React nodes.
 *
 * Must degrade, never crash, and never emit the literal string
 * "[object Object]" -- a malformed or partial node (missing `fields`, a `null`
 * `fields`, an unknown `blockType`, a non-array `images`) contributes empty
 * string rather than throwing or blindly stringifying an object. This is the
 * same contract every renderer in this batch holds: a bad node degrades
 * silently rather than turning a 200 into a 500.
 *
 * | node | contributes |
 * |---|---|
 * | socialEmbed | its caption, or nothing |
 * | image (upload node) | alt text and caption |
 * | gallery | the per-image captions, concatenated |
 * | audio | its title |
 * | embedFrame | its title |
 * | unknown block type | nothing, silently |
 */

const MEDIA_BLOCK_TYPES = new Set(["socialEmbed", "gallery", "audio", "embedFrame"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Only ever joins actual strings -- never `String(x)` on an unknown value,
 *  which is exactly how "[object Object]" leaks into extracted text. */
function joinParts(parts: string[]): string {
  return parts.filter((part) => part.trim().length > 0).join(" ");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractUploadNode(node: Record<string, unknown>): string {
  const media = isRecord(node.value) ? node.value : null;
  const fields = isRecord(node.fields) ? node.fields : null;
  return joinParts([asString(media?.alt), asString(fields?.caption)]);
}

function extractGalleryImages(fields: Record<string, unknown>): string {
  const images = fields.images;
  if (!Array.isArray(images)) return "";
  return joinParts(images.map((image) => (isRecord(image) ? asString(image.caption) : "")));
}

function extractBlockNode(node: Record<string, unknown>): string {
  const fields = isRecord(node.fields) ? node.fields : null;
  if (!fields) return "";

  const blockType = asString(fields.blockType);
  switch (blockType) {
    case "socialEmbed":
      return asString(fields.caption);
    case "gallery":
      return extractGalleryImages(fields);
    case "audio":
    case "embedFrame":
      return asString(fields.title);
    default:
      // Unknown block type (including a future block this extractor hasn't
      // been taught about yet): contribute nothing, silently.
      return "";
  }
}

function extractNode(node: unknown): string {
  if (!isRecord(node)) return "";

  switch (node.type) {
    case "text":
      return asString(node.text);
    case "upload":
      return extractUploadNode(node);
    case "block":
      return extractBlockNode(node);
    default:
      // Generic element node (paragraph, heading, list, listitem, quote,
      // link, etc.) -- recurse into children so nested text still counts.
      return Array.isArray(node.children) ? joinParts(node.children.map(extractNode)) : "";
  }
}

export function extractPlainText(content: unknown): string {
  if (!isRecord(content)) return "";
  const root = content.root;
  if (!isRecord(root) || !Array.isArray(root.children)) return "";
  return joinParts(root.children.map(extractNode)).trim();
}

function nodeHasMediaBlock(node: unknown): boolean {
  if (!isRecord(node)) return false;

  if (node.type === "upload") return true;

  if (node.type === "block") {
    const fields = isRecord(node.fields) ? node.fields : null;
    const blockType = fields ? asString(fields.blockType) : "";
    if (MEDIA_BLOCK_TYPES.has(blockType)) return true;
  }

  return Array.isArray(node.children) ? node.children.some(nodeHasMediaBlock) : false;
}

/**
 * True when the body contains at least one media block anywhere in the tree:
 * `socialEmbed`, `gallery`, `audio`, `embedFrame`, or an inline upload (image)
 * node. Used by `tierForLexicalBody` (Task 7) to make such an article
 * ineligible for `archive-brief` regardless of text length.
 */
export function hasMediaBlock(content: unknown): boolean {
  if (!isRecord(content)) return false;
  const root = content.root;
  if (!isRecord(root) || !Array.isArray(root.children)) return false;
  return root.children.some(nodeHasMediaBlock);
}
