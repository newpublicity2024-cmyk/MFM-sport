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

export function LeagueCarousel({ leagues, locale, label }: Props) {
  if (leagues.length === 0) return null;

  return (
    <nav
      aria-label={label}
      className="mb-4 flex gap-2 overflow-x-auto border-b border-border pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {leagues.map((league) => (
        <Link
          key={league.slug}
          href={`/${locale}/competition/${league.slug}`}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-muted px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/10"
        >
          <Image
            src={league.logoUrl}
            alt=""
            width={20}
            height={20}
            className="shrink-0"
          />
          <span>{league.name}</span>
        </Link>
      ))}
    </nav>
  );
}
