/**
 * The always-visible caption + "view on the original platform" link rendered
 * beneath a Facebook/Instagram iframe (and reused for the youtube.com branch of
 * SocialEmbedRenderer -- see that file).
 *
 * A1 — THIS MUST RENDER UNCONDITIONALLY. A deleted post, a private account and a
 * suspended one all return HTTP 200 from the embed endpoint and paint zero
 * images, and that failure is undetectable cross-origin (a status-code check
 * would certify a broken embed as working). So there is no error state to
 * branch on here: if the iframe paints, this reads as a normal attribution
 * line; if it doesn't, the reader still has the caption and a working link.
 * Do not make the caller wrap this in a failure check "to avoid duplication" --
 * that would silently reintroduce the blank-rectangle bug this exists to close.
 */

type Props = {
  caption?: string | null;
  href: string;
  linkText: string;
};

export function SocialEmbedFallback({ caption, href, linkText }: Props) {
  return (
    <p className="mt-2 text-sm text-muted-foreground" dir="rtl">
      {caption ? <span>{caption} — </span> : null}
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
        {linkText}
      </a>
    </p>
  );
}
