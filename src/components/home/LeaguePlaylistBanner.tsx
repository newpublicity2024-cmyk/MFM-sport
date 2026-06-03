import Image from "next/image";

const PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PL3AfsMqHuUG2ribU3zGm6xQ9G5FSPiDuF";
const BANNER_SRC = "/images/actual-banner.jpeg";

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

  // On desktop the banner occupies the bottom-right cell of the section's subgrid
  // (col 3, row 2), so its top AND bottom line up with the bottom row of article
  // cards beside it. The image is contained (object-contain) so the whole artwork
  // shows without zooming. On mobile the holder falls back to a square.
  return (
    <a
      href={PLAYLIST_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/30 lg:aspect-auto lg:col-start-3 lg:row-start-2"
    >
      <Image
        src={BANNER_SRC}
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 33vw"
        className="object-contain transition-transform duration-300 group-hover:scale-105"
      />
    </a>
  );
}
