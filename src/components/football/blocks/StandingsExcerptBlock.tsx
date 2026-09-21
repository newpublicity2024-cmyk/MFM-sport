import type { Config } from "@/payload-types";
import type { ApiFixture } from "@/lib/api-football/types";
import { getStandingsGroups } from "@/lib/api-football/standings";
import { localizeLeague } from "@/lib/api-football/localize";
import { standingsExcerpt, type ExcerptRow } from "@/lib/football/standingsExcerpt";
import { getCompetitionByApiFootballId } from "@/lib/payload/queries";
import { StandingsExcerpt, type StandingsExcerptLabels } from "../StandingsExcerpt";

type Props = {
  fixture: ApiFixture;
  locale: string;
  labels: Omit<StandingsExcerptLabels, "caption"> & { captionTemplate: (competition: string) => string };
};

type Loaded = { rows: ExcerptRow[]; href: string | null };

/**
 * Reads the fixture's own season so the excerpt is the table of the
 * competition this match is part of. Anything that goes wrong upstream
 * (quota, timeout, a league with no table, teams in different groups)
 * resolves to null — a missing widget, never a failed page.
 */
async function load(fixture: ApiFixture, locale: string): Promise<Loaded | null> {
  try {
    const { id: leagueId, season } = fixture.league;
    const [groups, competition] = await Promise.all([
      getStandingsGroups(leagueId, season),
      getCompetitionByApiFootballId(leagueId, locale as Config["locale"]),
    ]);
    const excerpt = standingsExcerpt(groups, fixture.teams.home.id, fixture.teams.away.id);
    if (!excerpt) return null;
    // The competition page renders a table only for leagues; a cup's page has
    // no standings to link to.
    const href =
      competition?.slug && competition.type === "league"
        ? `/${locale}/competition/${competition.slug}`
        : null;
    return { rows: excerpt.rows, href };
  } catch (error) {
    console.error(`[match ${fixture.fixture.id}] standings excerpt unavailable:`, error);
    return null;
  }
}

/** Data glue for the standings excerpt; streams inside its own Suspense boundary. */
export async function StandingsExcerptBlock({ fixture, locale, labels }: Props) {
  const loaded = await load(fixture, locale);
  if (!loaded) return null;
  const { captionTemplate, ...rest } = labels;
  const league = localizeLeague(fixture.league.id, fixture.league.name, locale);
  return (
    <StandingsExcerpt
      rows={loaded.rows}
      highlightTeamIds={[fixture.teams.home.id, fixture.teams.away.id]}
      locale={locale}
      labels={{ ...rest, caption: captionTemplate(league) }}
      fullStandingsHref={loaded.href}
    />
  );
}
