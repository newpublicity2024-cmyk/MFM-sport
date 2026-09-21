import type { ApiFixture } from "@/lib/api-football/types";
import { getHeadToHead } from "@/lib/api-football/headToHead";
import { hasFinalScore } from "@/lib/api-football/status";
import { HeadToHead, type HeadToHeadLabels } from "../HeadToHead";

type Props = {
  fixture: ApiFixture;
  locale: string;
  labels: HeadToHeadLabels;
};

export const H2H_LENGTH = 5;

/**
 * The last five played meetings between the two teams, excluding the fixture
 * itself (once it has finished, upstream lists it among the meetings).
 * A first meeting, or any upstream trouble, renders nothing.
 */
async function load(fixture: ApiFixture): Promise<ApiFixture[] | null> {
  try {
    const { home, away } = fixture.teams;
    // Ask for one more than we show so the current fixture, once played, can
    // be dropped without shortening the list.
    const meetings = await getHeadToHead(home.id, away.id, H2H_LENGTH + 1);
    return meetings
      .filter((f) => hasFinalScore(f.fixture.status.short) && f.fixture.id !== fixture.fixture.id)
      .slice(0, H2H_LENGTH);
  } catch (error) {
    console.error(`[match ${fixture.fixture.id}] head-to-head unavailable:`, error);
    return null;
  }
}

export async function HeadToHeadBlock({ fixture, locale, labels }: Props) {
  const meetings = await load(fixture);
  if (!meetings) return null;
  return (
    <HeadToHead
      fixtures={meetings}
      teamA={fixture.teams.home}
      teamB={fixture.teams.away}
      locale={locale}
      labels={labels}
    />
  );
}
