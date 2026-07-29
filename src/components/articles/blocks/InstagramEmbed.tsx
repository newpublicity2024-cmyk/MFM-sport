import { instagramTransport } from "./instagramTransport";
import { SocialEmbedFallback } from "./SocialEmbedFallback";

type Props = {
  canonicalUrl: string;
  caption?: string | null;
};

const LINK_TEXT = "شاهد على إنستغرام";

export function InstagramEmbed({ canonicalUrl, caption }: Props) {
  const transport = instagramTransport(canonicalUrl);

  return (
    <div className="my-6">
      {transport && (
        <div
          data-embed-box
          className="relative w-full overflow-hidden rounded-lg bg-secondary"
          style={{ aspectRatio: transport.aspectRatio }}
        >
          <iframe
            src={transport.src}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            title="تضمين إنستغرام"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      )}
      {/*
        A1 — unconditional fallback, always rendered regardless of whether the
        iframe above exists or paints. See SocialEmbedFallback.tsx.
      */}
      <SocialEmbedFallback caption={caption} href={canonicalUrl} linkText={LINK_TEXT} />
    </div>
  );
}
