import type { ApiFixture } from "@/lib/api-football/types";
import { getFixturesByTeam } from "@/lib/api-football/fixtures";
import { hasFinalScore } from "@/lib/api-football/status";
import { RecentResults, type RecentResultsLabels } from "../RecentResults";

type Props = {
  fixture: ApiFixture;
  locale: string;
  labels: RecentResultsLabels;
};

export const FORM_LENGTH = 5;

/**
 * Each team's last five played matches in the fixture's season, every
 * competition included (a cup run is form too), newest first. Early in a
 * season a team may have fewer than five; the column shows what exists and
 * the stats' denominator follows. Upstream trouble → null, not a failed page.
 */
async function load(fixture: ApiFixture): Promise<{ home: ApiFixture[]; away: ApiFixture[] } | null> {
  try {
    const { season } = fixture.league;
    const { home, away } = fixture.teams;
    const [homeForm, awayForm] = await Promise.all([
      getFixturesByTeam(home.id, season, { last: FORM_LENGTH }),
      getFixturesByTeam(away.id, season, { last: FORM_LENGTH }),
    ]);
    const played = (list: ApiFixture[]) =>
      list
        .filter((f) => hasFinalScore(f.fixture.status.short) && f.fixture.id !== fixture.fixture.id)
        .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
        .slice(0, FORM_LENGTH);
    return { home: played(homeForm), away: played(awayForm) };
  } catch (error) {
    console.error(`[match ${fixture.fixture.id}] recent results unavailable:`, error);
    return null;
  }
}

export async function RecentResultsBlock({ fixture, locale, labels }: Props) {
  const loaded = await load(fixture);
  if (!loaded) return null;
  return (
    <RecentResults
      home={{ team: fixture.teams.home, fixtures: loaded.home }}
      away={{ team: fixture.teams.away, fixtures: loaded.away }}
      locale={locale}
      labels={labels}
    />
  );
}
