import { MatchCard } from "@/components/football/MatchCard";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = {
  fixtures: ApiFixture[];
  locale: string;
  title: string;
};

// Right-rail matches calendar for whichever competition Homepage Settings names
// (the World Cup once, now an editor's choice): a titled card whose body is a
// vertical scroll-snap slider sized to ~5 rows. Each child is shrink-0 so
// flex-col never crushes the rows (see the homepage matches-slider gotcha).
export function CompetitionCalendar({ fixtures, locale, title }: Props) {
  if (fixtures.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <h2 className="mb-2 px-1 text-sm font-bold">{title}</h2>
      <div
        data-competition-slider
        className="flex flex-col gap-2 overflow-y-auto no-scrollbar snap-y snap-mandatory max-h-[19rem]"
      >
        {fixtures.map((f) => (
          <div key={f.fixture.id} className="shrink-0 snap-start">
            <MatchCard fixture={f} locale={locale} />
          </div>
        ))}
      </div>
    </section>
  );
}
