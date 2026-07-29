import { facebookTransport } from "./facebookTransport";
import { SocialEmbedFallback } from "./SocialEmbedFallback";

type Props = {
  canonicalUrl: string;
  caption?: string | null;
};

const LINK_TEXT = "شاهد على فيسبوك";

export function FacebookEmbed({ canonicalUrl, caption }: Props) {
  const transport = facebookTransport(canonicalUrl);

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
            title="تضمين فيسبوك"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      )}
      {/*
        A1 — unconditional fallback, always rendered regardless of whether the
        iframe above exists or paints. Same reasoning as InstagramEmbed.tsx: a
        deleted post, a private account and a suspended one all return HTTP 200
        and paint nothing, and that's undetectable cross-origin.
      */}
      <SocialEmbedFallback caption={caption} href={canonicalUrl} linkText={LINK_TEXT} />
    </div>
  );
}
