import Image from "next/image";
import { MatchCard } from "./MatchCard";
import type { ApiFixture } from "@/lib/api-football/types";

type Props = {
  fixtures: ApiFixture[];
  locale: string;
  groupByLeague?: boolean;
};

export function MatchList({ fixtures, locale, groupByLeague = true }: Props) {
  if (fixtures.length === 0) return null;

  if (!groupByLeague) {
    return (
      <div className="space-y-2">
        {fixtures.map((f) => (
          <MatchCard key={f.fixture.id} fixture={f} locale={locale} />
        ))}
      </div>
    );
  }

  const grouped = fixtures.reduce<Record<string, { league: ApiFixture["league"]; fixtures: ApiFixture[] }>>(
    (acc, fixture) => {
      const key = String(fixture.league.id);
      if (!acc[key]) {
        acc[key] = { league: fixture.league, fixtures: [] };
      }
      acc[key].fixtures.push(fixture);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {Object.values(grouped).map((group) => (
        <div key={group.league.id}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Image src={group.league.logo} alt={group.league.name} width={20} height={20} />
            <span className="text-sm font-medium text-muted-foreground">{group.league.name}</span>
          </div>
          <div className="space-y-1">
            {group.fixtures.map((f) => (
              <MatchCard key={f.fixture.id} fixture={f} locale={locale} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
