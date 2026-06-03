import { HeroSlider } from "@/components/home/HeroSlider";
import { MatchesPanel } from "@/components/home/MatchesPanel";
import { SectionShell } from "@/components/home/SectionShell";
import type { HeroSlide } from "@/lib/home/cards";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = {
  slides: HeroSlide[];
  fixtures: ApiFixture[];
  locale: string;
  statusLabels: {
    finished: string;
    live: string;
    scheduled: string;
  };
};

export function HeroSection({ slides, fixtures, locale, statusLabels }: Props) {
  return (
    <SectionShell>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:h-[500px]">
        {/* Featured slider — fills grid cell height on desktop */}
        <div className="lg:col-span-2">
          <HeroSlider slides={slides} locale={locale} />
        </div>

        {/* Matches panel — same height as hero, scrollable */}
        <div className="lg:h-full overflow-y-auto">
          <MatchesPanel fixtures={fixtures} locale={locale} statusLabels={statusLabels} />
        </div>
      </div>
    </SectionShell>
  );
}
