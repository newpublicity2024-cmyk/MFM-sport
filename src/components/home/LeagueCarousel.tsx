import Image from "next/image";
import Link from "next/link";
import { LEAGUES, leagueName } from "@/lib/home/leagues";

type Props = {
  locale: string;
  label: string;
};

export function LeagueCarousel({ locale, label }: Props) {
  return (
    <nav
      aria-label={label}
      className="mb-4 flex gap-2 overflow-x-auto border-b border-border pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {LEAGUES.map((league) => (
        <Link
          key={league.id}
          href={`/${locale}/matches?league=${league.apiFootballId}`}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted"
        >
          <Image
            src={league.logoUrl}
            alt=""
            width={20}
            height={20}
            className="shrink-0"
          />
          <span>{leagueName(league, locale)}</span>
        </Link>
      ))}
    </nav>
  );
}
