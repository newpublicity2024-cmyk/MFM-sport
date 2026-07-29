import Image from "next/image";
import type { SerializedUploadNode } from "@payloadcms/richtext-lexical";
import type { Media } from "@/payload-types";

/**
 * Per-usage `caption`/`credit` fields UploadFeature adds to the upload node
 * inside THIS article's body (Task 4, `payload.config.ts`). These are
 * collection-scoped extra fields on the Lexical upload node's own `fields`
 * object, not a Payload collection or block, so Payload's type generator does
 * not emit an interface for them. This local type stands in deliberately
 * instead of reaching for `any`.
 */
type ArticleImageUsageFields = {
  caption?: string | null;
  credit?: string | null;
};

// Matches the article column width used elsewhere for in-body/hero images
// (see the article page's own hero <Image sizes="...">).
const ARTICLE_IMAGE_SIZES = "(max-width: 896px) 100vw, 896px";

/**
 * Overrides Payload's default `UploadJSXConverter`, which emits a bare `<img>`
 * (unsized, unoptimised, CLS-generating) or a `<picture>` built from
 * `uploadDoc.sizes`. This emits `next/image` with explicit width/height instead
 * — deliberately NOT `priority`, which belongs to the hero image only.
 *
 * Guards `mimeType`: the library default calls `uploadDoc.mimeType.startsWith(...)`
 * unguarded, and `Media.mimeType` is nullable on the generated type. Media now
 * also accepts audio (Task 4), so a non-image upload node placed inline (e.g. a
 * journalist using the generic image-insert command on an audio file) must
 * degrade to a plain link rather than throw.
 */
export const articleImageConverter = ({ node }: { node: SerializedUploadNode }) => {
  const value = node.value;
  if (typeof value !== "object" || value === null) return null;

  const media = value as Media;
  if (!media.url) return null;

  const mimeType = media.mimeType ?? "";
  if (!mimeType.startsWith("image")) {
    // Same non-image fallback as the library default, minus the unguarded throw.
    return (
      <a href={media.url} rel="noopener noreferrer">
        {media.filename || media.url}
      </a>
    );
  }

  const fields = (node.fields ?? {}) as ArticleImageUsageFields;
  const alt = media.alt || "";

  if (!media.width || !media.height) {
    // Can't size next/image safely without both dimensions -- fall back to a
    // plain img rather than silently dropping a real image. Payload computes
    // width/height for every image upload via sharp, so this should be rare.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.url} alt={alt} />;
  }

  const hasCaption = Boolean(fields.caption);
  const hasCredit = Boolean(fields.credit);

  return (
    <figure className="my-6">
      <Image
        src={media.url}
        alt={alt}
        width={media.width}
        height={media.height}
        sizes={ARTICLE_IMAGE_SIZES}
        className="h-auto w-full rounded-lg"
      />
      {(hasCaption || hasCredit) && (
        <figcaption className="mt-2 text-xs text-muted-foreground" dir="rtl">
          {fields.caption}
          {hasCaption && hasCredit ? " — " : ""}
          {fields.credit}
        </figcaption>
      )}
    </figure>
  );
};
