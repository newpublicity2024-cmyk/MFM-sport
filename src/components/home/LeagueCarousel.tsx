import Image from "next/image";
import Link from "next/link";

export type CarouselLeague = {
  slug: string;
  name: string;
  logoUrl: string;
};

type Props = {
  leagues: CarouselLeague[];
  locale: string;
  label: string;
};

// beIN-style top strip: league crests only (no names), ~48px, horizontally
// scrollable. The league name lives in each link's aria-label + title (hover
// tooltip) for accessibility — it is never rendered as visible text.
export function LeagueCarousel({ leagues, locale, label }: Props) {
  if (leagues.length === 0) return null;

  return (
    <nav
      aria-label={label}
      className="mb-4 flex gap-5 overflow-x-auto border-b border-border pb-4 no-scrollbar"
    >
      {leagues.map((league) => (
        <Link
          key={league.slug}
          href={`/${locale}/competition/${league.slug}`}
          aria-label={league.name}
          title={league.name}
          className="flex shrink-0 items-center justify-center transition-transform hover:scale-110"
        >
          <Image
            src={league.logoUrl}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
          />
        </Link>
      ))}
    </nav>
  );
}
