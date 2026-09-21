import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import type { ApiFixture } from "@/lib/api-football/types";
import { localizeLeague, localizeTeam } from "@/lib/api-football/localize";
import { isIndexableFixture } from "@/lib/seo/matchIndexing";
import { resultFor, type Result } from "@/lib/football/formStats";

export type ResultLabels = { win: string; draw: string; loss: string };

const RESULT_LETTER: Record<Result, string> = { W: "ف", D: "ت", L: "خ" };

type Props = {
  fixture: ApiFixture;
  /** Whose result badge to show; omitted for a neutral head-to-head row. */
  perspectiveTeamId?: number;
  locale: string;
  labels: ResultLabels;
  showCompetition?: boolean;
  /** Attributes for the <li>, e.g. a data marker the served-bytes checks count. */
  liProps?: React.LiHTMLAttributes<HTMLLIElement>;
};

/**
 * One past match: date, home – score – away, a lettered result badge and,
 * optionally, the competition. Links to the match page ONLY when that page
 * is indexable: a link into a noindex fixture is a crawl path into a page we
 * have asked Google to ignore, the same shape as the /matches trap.
 */
export function ResultRow({ fixture, perspectiveTeamId, locale, labels, showCompetition = false, liProps }: Props) {
  const { home, away } = fixture.teams;
  const result = perspectiveTeamId != null ? resultFor(fixture, perspectiveTeamId) : null;
  const linkable = isIndexableFixture(fixture);
  const homeName = localizeTeam(home.id, home.name, locale);
  const awayName = localizeTeam(away.id, away.name, locale);
  const isPerspective = (id: number) => id === perspectiveTeamId;

  const body = (
    <>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-24">
        {formatDate(fixture.fixture.date, locale)}
      </span>
      <span className="flex-1 min-w-0 flex items-center justify-center gap-2 text-sm">
        <span className={cn("truncate text-end flex-1", isPerspective(home.id) && "font-bold")}>{homeName}</span>
        <span className="tabular-nums font-bold shrink-0 rounded bg-secondary px-1.5">
          {fixture.goals.home ?? "-"} - {fixture.goals.away ?? "-"}
        </span>
        <span className={cn("truncate text-start flex-1", isPerspective(away.id) && "font-bold")}>{awayName}</span>
      </span>
      {result && (
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
      )}
    </>
  );

  const className = "flex items-center gap-3 py-2 border-b border-border last:border-b-0";
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
      {showCompetition && (
        <div className="text-[11px] text-muted-foreground -mt-1 pb-1 ps-24">
          {localizeLeague(fixture.league.id, fixture.league.name, locale)}
        </div>
      )}
    </li>
  );
}
