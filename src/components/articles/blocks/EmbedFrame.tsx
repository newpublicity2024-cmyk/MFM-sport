import { isAllowedIframeSrc } from "@/lib/embeds/iframeAllowlist";

type Props = {
  src: string | null | undefined;
  height: number | null | undefined;
  title: string | null | undefined;
};

const DEFAULT_HEIGHT = 400;

/**
 * Generic allowlisted iframe (Datawrapper, Google Maps, SoundCloud, Spotify).
 *
 * Re-validates `src` against the same shared `isAllowedIframeSrc` the block's
 * own `validate()` uses at write time -- defense in depth, not duplicated
 * logic: Lexical content is stored JSON that can outlive an allowlist change,
 * so this fails closed (renders nothing) rather than trusting stored data.
 */
export function EmbedFrame({ src, height, title }: Props) {
  if (!isAllowedIframeSrc(src)) return null;

  return (
    <div className="my-6">
      <iframe
        src={src as string}
        height={height ?? DEFAULT_HEIGHT}
        width="100%"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        title={title || "إطار مضمّن"}
        className="w-full rounded-lg border-0"
      />
    </div>
  );
}
