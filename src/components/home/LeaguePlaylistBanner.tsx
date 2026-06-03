import Image from "next/image";

const PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PL3AfsMqHuUG2ribU3zGm6xQ9G5FSPiDuF";
const BANNER_SRC = "/images/box-banner.jpg";

const LABELS: Record<string, string> = {
  en: "Featured playlist on YouTube",
  ar: "قائمة تشغيل مميزة على يوتيوب",
  fr: "Playlist en vedette sur YouTube",
};

type Props = {
  locale: string;
};

export function LeaguePlaylistBanner({ locale }: Props) {
  const label = LABELS[locale] ?? LABELS.en;

  // On desktop the banner is a flex child of the leagues column: it grows to fill
  // the space left under the panel so its bottom aligns with the article grid next
  // to it (the image is cropped via object-cover to fit). On mobile it falls back to
  // a square. When swapping in the final artwork, design it for a tall ~3:4 slot.
  return (
    <a
      href={PLAYLIST_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/30 lg:aspect-auto lg:min-h-0 lg:flex-1"
    >
      <Image
        src={BANNER_SRC}
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 33vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </a>
  );
}
