import { HeroSlider } from "@/components/home/HeroSlider";
import { LeagueCarousel, type CarouselLeague } from "@/components/home/LeagueCarousel";
import { MatchesPanel } from "@/components/home/MatchesPanel";
import { SectionShell } from "@/components/home/SectionShell";
import type { HeroSlide } from "@/lib/home/cards";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = {
  slides: HeroSlide[];
  fixtures: ApiFixture[];
  locale: string;
  leaguesLabel: string;
  leagues: CarouselLeague[];
  statusLabels: {
    finished: string;
    live: string;
    scheduled: string;
  };
  /** Featured competition's API-Football league id — its group starts expanded. */
  openLeagueId?: number | null;
  /** API-Football league id → CMS crest / display order (see competitionOrder). */
  logoOverrides?: Record<number, string>;
  leagueOrder?: Record<number, number>;
};

export function HeroSection({
  slides,
  fixtures,
  locale,
  leaguesLabel,
  leagues,
  statusLabels,
  openLeagueId,
  logoOverrides,
  leagueOrder,
}: Props) {
  return (
    <SectionShell>
      <LeagueCarousel leagues={leagues} locale={locale} label={leaguesLabel} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:h-[500px]">
        {/* Featured slider — fills grid cell height on desktop */}
        <div className="lg:col-span-2">
          <HeroSlider slides={slides} locale={locale} />
        </div>

        {/* Matches panel — same height as hero, scrollable */}
        <div className="lg:h-full overflow-y-auto">
          <MatchesPanel
            fixtures={fixtures}
            locale={locale}
            statusLabels={statusLabels}
            openLeagueId={openLeagueId}
            logoOverrides={logoOverrides}
            leagueOrder={leagueOrder}
          />
        </div>
      </div>
    </SectionShell>
  );
}
