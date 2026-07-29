import { parseEmbed } from "@/lib/embeds/parseEmbed";
import { XEmbed } from "./XEmbed";
import { FacebookEmbed } from "./FacebookEmbed";
import { InstagramEmbed } from "./InstagramEmbed";
import { SocialEmbedFallback } from "./SocialEmbedFallback";

type Props = {
  source: string;
  caption?: string | null;
};

/**
 * Renderer for the `socialEmbed` block. `source` is stored as a plain string (no
 * separate platform/id field), so this always re-derives platform/id/canonicalUrl
 * from the same `parseEmbed` chokepoint used at write time -- never trusting the
 * stored value's shape directly, and never building an iframe/tweet src from
 * anything but the parser's validated `canonicalUrl`.
 *
 * `parseEmbed` never throws, and neither does this: a malformed or legacy
 * `source` (should be impossible given the block's own `validate()`, but data
 * can outlive code) renders nothing rather than a 500.
 */
export function SocialEmbedRenderer({ source, caption }: Props) {
  const result = parseEmbed(source);
  if (!result.ok) return null;

  const { embed } = result;

  switch (embed.platform) {
    case "x":
      return <XEmbed id={embed.id} canonicalUrl={embed.canonicalUrl} caption={caption} />;
    case "facebook":
      return <FacebookEmbed canonicalUrl={embed.canonicalUrl} caption={caption} />;
    case "instagram":
      return <InstagramEmbed canonicalUrl={embed.canonicalUrl} caption={caption} />;
    case "youtube":
      // Deliberate scope decision, not an oversight: parseEmbed supports YouTube
      // as a fourth socialEmbed platform (a journalist can paste a YouTube link
      // into this same block), but Task 5 specifies no dedicated YouTube
      // renderer here -- the design doc's "lite facade" is separate, future
      // work. Rendering nothing for a whole platform would silently drop
      // real editorial content, so this reuses the same always-visible
      // caption+link pattern already required for Facebook/Instagram rather
      // than inventing new (unspecified) facade UI. See task-567-report.md.
      return <SocialEmbedFallback caption={caption} href={embed.canonicalUrl} linkText="شاهد على يوتيوب" />;
    default:
      return null;
  }
}
