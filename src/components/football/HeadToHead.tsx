import Image from "next/image";
import type { ApiFixture } from "@/lib/api-football/types";
import { localizeTeam } from "@/lib/api-football/localize";
import { h2hSummary } from "@/lib/football/formStats";
import { ResultRow, type ResultLabels } from "./ResultRow";

export type HeadToHeadLabels = ResultLabels & {
  title: string;
  wins: string;
  draws: string;
  goals: string;
};

type Props = {
  fixtures: ApiFixture[];
  teamA: ApiFixture["teams"]["home"];
  teamB: ApiFixture["teams"]["away"];
  locale: string;
  labels: HeadToHeadLabels;
};

/**
 * The last meetings between the two teams: per-team win/draw/win counters,
 * the list, and a split bar of aggregate goals. Counters are per team, not
 * per home/away side, and they are computed from the rows rendered below
 * them. Team A (the fixture's home side) comes first in the DOM and in every
 * row, so it sits on the right under dir="rtl" like everywhere else on the
 * page; a venue tag says who hosted each meeting.
 */
export function HeadToHead({ fixtures, teamA, teamB, locale, labels }: Props) {
  if (fixtures.length === 0) return null;
  const s = h2hSummary(fixtures, teamA.id, teamB.id);
  const nameA = localizeTeam(teamA.id, teamA.name, locale);
  const nameB = localizeTeam(teamB.id, teamB.name, locale);
  const goalsTotal = s.goalsA + s.goalsB;
  const shareA = goalsTotal === 0 ? 50 : Math.round((s.goalsA / goalsTotal) * 100);

  return (
    <section data-block="h2h" aria-labelledby="h2h-heading" className="mb-8 bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="flex items-center gap-2 font-bold">
          <Image src={teamA.logo} alt="" width={24} height={24} />
          <span>{nameA}</span>
        </span>
        <h2 id="h2h-heading" className="text-base font-bold text-center">{labels.title}</h2>
        <span className="flex items-center gap-2 font-bold">
          <span>{nameB}</span>
          <Image src={teamB.logo} alt="" width={24} height={24} />
        </span>
      </div>

      <dl className="grid grid-cols-3 text-center mb-4">
        {(
          [
            ["winsA", `${labels.wins} ${nameA}`, s.winsA],
            ["draws", labels.draws, s.draws],
            ["winsB", `${labels.wins} ${nameB}`, s.winsB],
          ] as const
        ).map(([key, label, value]) => (
          // Label first in the DOM (a dt precedes its dd); the number is shown above it.
          <div key={key} className="flex flex-col-reverse">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd data-h2h={key} data-value={value} className="text-3xl font-bold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <ul>
        {fixtures.map((fx) => (
          <ResultRow
            key={fx.fixture.id}
            fixture={fx}
            locale={locale}
            labels={labels}
            fixedFirstTeamId={teamA.id}
            liProps={{ "data-h2h-row": "" } as React.LiHTMLAttributes<HTMLLIElement>}
          />
        ))}
      </ul>

      <div className="mt-4">
        <div className="text-center text-xs text-muted-foreground mb-1">{labels.goals}</div>
        <div
          role="img"
          aria-label={`${labels.goals}: ${nameA} ${s.goalsA}، ${nameB} ${s.goalsB}`}
          className="flex items-center gap-2 text-sm font-bold tabular-nums"
        >
          <span>{s.goalsA}</span>
          <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-secondary">
            <span className="bg-primary h-full" style={{ width: `${shareA}%` }} />
            <span className="bg-foreground/25 h-full" style={{ width: `${100 - shareA}%` }} />
          </div>
          <span>{s.goalsB}</span>
        </div>
      </div>
    </section>
  );
}
