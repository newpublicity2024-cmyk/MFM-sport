import type { ApiFixture } from "@/lib/api-football/types";
import { getTeamRecentFixtures } from "@/lib/api-football/fixtures";
import { hasFinalScore } from "@/lib/api-football/status";
import { RecentResults, type RecentResultsLabels } from "../RecentResults";

type Props = {
  fixture: ApiFixture;
  locale: string;
  labels: RecentResultsLabels;
};

export const FORM_LENGTH = 5;

/**
 * Each team's last five played matches across seasons, every competition
 * included (a cup run is form too), newest first. Not bound to the fixture's
 * season: in the first weeks of a campaign that read came back empty and the
 * column showed 0/0. Upstream trouble → null, not a failed page.
 */
async function load(fixture: ApiFixture): Promise<{ home: ApiFixture[]; away: ApiFixture[] } | null> {
  try {
    const { home, away } = fixture.teams;
    // One more than shown: once this fixture is played it is among the team's
    // last matches and is dropped below, and the column should still show five.
    const [homeForm, awayForm] = await Promise.all([
      getTeamRecentFixtures(home.id, FORM_LENGTH + 1),
      getTeamRecentFixtures(away.id, FORM_LENGTH + 1),
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
