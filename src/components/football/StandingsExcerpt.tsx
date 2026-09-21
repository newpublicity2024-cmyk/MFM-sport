import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { localizeTeam } from "@/lib/api-football/localize";
import { isGapRow, type ExcerptRow } from "@/lib/football/standingsExcerpt";
import { FormBadges } from "./StandingsTable";

export type StandingsExcerptLabels = {
  caption: string;
  fullStandings: string;
  team: string;
  played: string;
  won: string;
  drawn: string;
  lost: string;
  goalsFor: string;
  goalsAgainst: string;
  goalDiff: string;
  points: string;
  form: string;
};

type Props = {
  rows: ExcerptRow[];
  /** The two teams of the fixture; their rows are highlighted. */
  highlightTeamIds: readonly [number, number];
  locale: string;
  labels: StandingsExcerptLabels;
  /** The competition's standings page, or null when the CMS has no page for this league. */
  fullStandingsHref: string | null;
};

/**
 * A six-row window of the table around the two teams — Kooora's "ترتيب"
 * card. Deliberately an excerpt with a link to the competition page, not the
 * whole table: a full table repeated on every match page would be the same
 * block duplicated across hundreds of URLs, competing with the one page that
 * should rank for "ترتيب البطولة".
 */
export function StandingsExcerpt({ rows, highlightTeamIds, locale, labels, fullStandingsHref }: Props) {
  if (rows.length === 0) return null;
  const highlighted = new Set(highlightTeamIds);
  const columns = 11;

  return (
    <section data-block="standings" aria-labelledby="standings-excerpt-caption" className="mb-8">
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <caption id="standings-excerpt-caption" className="text-start text-base font-bold p-3 border-b border-border">
            {labels.caption}
          </caption>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead scope="col" className="w-8 text-center">#</TableHead>
              <TableHead scope="col">{labels.team}</TableHead>
              <TableHead scope="col" className="w-8 text-center">{labels.played}</TableHead>
              <TableHead scope="col" className="w-8 text-center">{labels.won}</TableHead>
              <TableHead scope="col" className="w-8 text-center">{labels.drawn}</TableHead>
              <TableHead scope="col" className="w-8 text-center">{labels.lost}</TableHead>
              <TableHead scope="col" className="w-8 text-center hidden sm:table-cell">{labels.goalsFor}</TableHead>
              <TableHead scope="col" className="w-8 text-center hidden sm:table-cell">{labels.goalsAgainst}</TableHead>
              <TableHead scope="col" className="w-8 text-center">{labels.goalDiff}</TableHead>
              <TableHead scope="col" className="w-8 text-center font-bold">{labels.points}</TableHead>
              <TableHead scope="col" className="hidden sm:table-cell">{labels.form}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) =>
              isGapRow(row) ? (
                <TableRow key={`gap-${i}`} data-gap aria-hidden="true">
                  <TableCell colSpan={columns} className="text-center text-muted-foreground py-1">
                    …
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow
                  key={row.team.id}
                  data-rank={row.rank}
                  aria-current={highlighted.has(row.team.id) ? "true" : undefined}
                  className={cn(highlighted.has(row.team.id) && "bg-primary/10 font-semibold")}
                >
                  <TableCell className="text-center text-xs font-medium text-muted-foreground">
                    {row.rank}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Image src={row.team.logo} alt="" width={20} height={20} className="shrink-0" />
                      <span className="text-sm truncate">{localizeTeam(row.team.id, row.team.name, locale)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">{row.all.played}</TableCell>
                  <TableCell className="text-center text-sm">{row.all.win}</TableCell>
                  <TableCell className="text-center text-sm">{row.all.draw}</TableCell>
                  <TableCell className="text-center text-sm">{row.all.lose}</TableCell>
                  <TableCell className="text-center text-sm hidden sm:table-cell">{row.all.goals.for}</TableCell>
                  <TableCell className="text-center text-sm hidden sm:table-cell">{row.all.goals.against}</TableCell>
                  <TableCell className={cn("text-center text-sm", row.goalsDiff > 0 && "text-win", row.goalsDiff < 0 && "text-loss")}>
                    {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
                  </TableCell>
                  <TableCell className="text-center text-sm font-bold">{row.points}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <FormBadges form={row.form} />
                  </TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </div>
      {fullStandingsHref && (
        <div className="mt-3 text-center">
          <Link
            href={fullStandingsHref}
            className="inline-block rounded-md border border-border px-4 py-2 text-sm hover:border-primary/40 transition-colors"
          >
            {labels.fullStandings}
          </Link>
        </div>
      )}
    </section>
  );
}
