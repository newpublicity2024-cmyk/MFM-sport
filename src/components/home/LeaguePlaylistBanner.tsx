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

  return (
    <a
      href={PLAYLIST_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="group block overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/30"
    >
      <Image
        src={BANNER_SRC}
        alt={label}
        width={300}
        height={300}
        sizes="(max-width: 1024px) 100vw, 33vw"
        className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </a>
  );
}
