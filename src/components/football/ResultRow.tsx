import Image from "next/image";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import type { ApiFixture } from "@/lib/api-football/types";
import { localizeLeague, localizeTeam } from "@/lib/api-football/localize";
import { isIndexableFixture } from "@/lib/seo/matchIndexing";
import { goalsFor, resultFor, type Result } from "@/lib/football/formStats";

export type ResultLabels = {
  win: string;
  draw: string;
  loss: string;
  /** "at home" / "away" markers next to a team. */
  atHome: string;
  away: string;
};

const RESULT_LETTER: Record<Result, string> = { W: "ف", D: "ت", L: "خ" };

type Props = {
  fixture: ApiFixture;
  locale: string;
  labels: ResultLabels;
  /**
   * The team the row is told from. Recent results: that team is the column's
   * heading, so the row shows only the venue marker, the opponent and the
   * score oriented team–opponent. Head-to-head: `fixedFirstTeamId`.
   */
  perspectiveTeamId?: number;
  /** Head-to-head: this team always sits in the first slot, the other in the second. */
  fixedFirstTeamId?: number;
  /** Attributes for the <li>, e.g. a data marker the served-bytes checks count. */
  liProps?: React.LiHTMLAttributes<HTMLLIElement>;
};

function VenueTag({ home, labels }: { home: boolean; labels: ResultLabels }) {
  return (
    <span
      data-venue={home ? "home" : "away"}
      className={cn(
        "shrink-0 rounded px-1 text-[10px] leading-4",
        home ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
      )}
    >
      {home ? labels.atHome : labels.away}
    </span>
  );
}

function Score({ first, second }: { first: number | null; second: number | null }) {
  return (
    <span className="tabular-nums font-bold shrink-0 rounded bg-secondary px-1.5" data-score={`${first ?? "-"}-${second ?? "-"}`}>
      {first ?? "-"} - {second ?? "-"}
    </span>
  );
}

/**
 * One past match. Every row keeps the same shape, whatever side each team
 * played on — a reader scanning a column should never have to work out
 * which name is "ours" on this line. Links to the match page ONLY when that
 * page is indexable: a link into a noindex fixture is a crawl path into a page
 * we have asked Google to ignore, the same shape as the /matches trap.
 */
export function ResultRow({ fixture, locale, labels, perspectiveTeamId, fixedFirstTeamId, liProps }: Props) {
  const { home, away } = fixture.teams;
  const linkable = isIndexableFixture(fixture);
  const name = (team: typeof home) => localizeTeam(team.id, team.name, locale);
  const crest = (team: typeof home) => (
    <Image src={team.logo} alt="" width={18} height={18} className="shrink-0" />
  );

  let middle: React.ReactNode;
  let badge: React.ReactNode = null;

  if (perspectiveTeamId != null) {
    const isHome = home.id === perspectiveTeamId;
    const opponent = isHome ? away : home;
    const g = goalsFor(fixture, perspectiveTeamId);
    const result = resultFor(fixture, perspectiveTeamId);
    middle = (
      <>
        <VenueTag home={isHome} labels={labels} />
        <Score first={g?.scored ?? null} second={g?.conceded ?? null} />
        <span className="flex items-center gap-1.5 min-w-0 flex-1" data-opponent={opponent.id}>
          {crest(opponent)}
          <span className="truncate text-sm">{name(opponent)}</span>
        </span>
      </>
    );
    if (result) {
      badge = (
        <span
          data-result={result}
          aria-label={result === "W" ? labels.win : result === "D" ? labels.draw : labels.loss}
          className={cn(
            "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white shrink-0",
            result === "W" && "bg-win",
            result === "D" && "bg-draw",
            result === "L" && "bg-loss",
          )}
        >
          <span aria-hidden="true">{RESULT_LETTER[result]}</span>
        </span>
      );
    }
  } else {
    const firstIsHome = fixedFirstTeamId == null || home.id === fixedFirstTeamId;
    const first = firstIsHome ? home : away;
    const second = firstIsHome ? away : home;
    const goalsFirst = firstIsHome ? fixture.goals.home : fixture.goals.away;
    const goalsSecond = firstIsHome ? fixture.goals.away : fixture.goals.home;
    middle = (
      <>
        <span className="flex items-center justify-end gap-1.5 min-w-0 flex-1" data-slot="first">
          <span className="truncate text-sm">{name(first)}</span>
          {firstIsHome && <VenueTag home labels={labels} />}
        </span>
        <Score first={goalsFirst} second={goalsSecond} />
        <span className="flex items-center gap-1.5 min-w-0 flex-1" data-slot="second">
          {!firstIsHome && <VenueTag home labels={labels} />}
          <span className="truncate text-sm">{name(second)}</span>
        </span>
      </>
    );
  }

  const body = (
    <>
      <span className="flex flex-col shrink-0 w-24 text-xs text-muted-foreground leading-tight">
        <span className="tabular-nums">{formatDate(fixture.fixture.date, locale)}</span>
        <span className="text-[10px] truncate">{localizeLeague(fixture.league.id, fixture.league.name, locale)}</span>
      </span>
      {middle}
      {badge}
    </>
  );

  const className = "flex items-center gap-2 py-2 border-b border-border last:border-b-0";
  return (
    <li {...liProps}>
      {linkable ? (
        <Link href={`/${locale}/matches/${fixture.fixture.id}`} className={cn(className, "hover:bg-secondary/30 rounded")}>
          {body}
        </Link>
      ) : (
        <div className={className} data-unlinked-fixture={fixture.fixture.id}>
          {body}
        </div>
      )}
    </li>
  );
}
