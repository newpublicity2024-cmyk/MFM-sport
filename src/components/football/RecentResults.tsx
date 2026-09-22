import Image from "next/image";
import { SectionHeader } from "@/components/shared/SectionHeader";
import type { ApiFixture } from "@/lib/api-football/types";
import { localizeTeam } from "@/lib/api-football/localize";
import { formStats } from "@/lib/football/formStats";
import { ResultRow, type ResultLabels } from "./ResultRow";

export type RecentResultsLabels = ResultLabels & {
  title: string;
  scoredIn: string;
  over25: string;
  bothScored: string;
  noResults: string;
};

export type TeamForm = {
  team: ApiFixture["teams"]["home"];
  /** Most recent first; every competition, labelled per row. */
  fixtures: ApiFixture[];
};

type Props = {
  home: TeamForm;
  away: TeamForm;
  locale: string;
  labels: RecentResultsLabels;
};

function FormColumn({ side, form, locale, labels }: { side: "home" | "away"; form: TeamForm; locale: string; labels: RecentResultsLabels }) {
  const stats = formStats(form.fixtures, form.team.id);
  const rows: { key: string; label: string; value: number }[] = [
    { key: "scoredIn", label: labels.scoredIn, value: stats.scoredIn },
    { key: "over25", label: labels.over25, value: stats.over25 },
    { key: "bothScored", label: labels.bothScored, value: stats.bothScored },
  ];
  return (
    <div data-form-column={side} className="bg-card rounded-lg border border-border p-4">
      <h3 className="flex items-center gap-2 font-bold mb-3">
        <Image src={form.team.logo} alt="" width={24} height={24} />
        <span>{localizeTeam(form.team.id, form.team.name, locale)}</span>
      </h3>
      {form.fixtures.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground" data-empty>
          {labels.noResults}
        </p>
      ) : (
        <>
          <ul>
            {form.fixtures.map((fx) => (
              <ResultRow
                key={fx.fixture.id}
                fixture={fx}
                perspectiveTeamId={form.team.id}
                locale={locale}
                labels={labels}
              />
            ))}
          </ul>
          <dl className="mt-3 pt-3 border-t border-border grid grid-cols-[1fr_auto] gap-y-1 text-xs">
            {rows.map((r) => (
              <div key={r.key} className="contents">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd data-stat={r.key} data-value={`${r.value}/${stats.total}`} className="tabular-nums font-medium">
                  {r.value}/{stats.total}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

/**
 * Each team's last five matches with the three "x/N" rows computed from the
 * same five rows — see lib/football/formStats for why that matters. Home
 * column first in the DOM so it sits on the right under dir="rtl", mirroring
 * the scoreboard above it. A team with nothing to show gets one line, not an
 * empty card with 0/0 statistics.
 */
export function RecentResults({ home, away, locale, labels }: Props) {
  if (home.fixtures.length === 0 && away.fixtures.length === 0) return null;
  return (
    <section data-block="results" aria-labelledby="recent-results-heading" className="mb-8">
      <div id="recent-results-heading">
        <SectionHeader title={labels.title} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormColumn side="home" form={home} locale={locale} labels={labels} />
        <FormColumn side="away" form={away} locale={locale} labels={labels} />
      </div>
    </section>
  );
}
