import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApiStandingRow } from "@/lib/api-football/types";

type Props = {
  standings: ApiStandingRow[];
  locale: string;
  labels: {
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
};

function FormBadges({ form }: { form: string | null }) {
  if (!form) return null;
  return (
    <div className="flex gap-0.5">
      {form.split("").map((char, i) => (
        <span
          key={i}
          className={cn(
            "w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white",
            char === "W" && "bg-win",
            char === "D" && "bg-draw",
            char === "L" && "bg-loss",
          )}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

export function StandingsTable({ standings, locale, labels }: Props) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/50">
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead>{labels.team}</TableHead>
            <TableHead className="w-8 text-center">{labels.played}</TableHead>
            <TableHead className="w-8 text-center">{labels.won}</TableHead>
            <TableHead className="w-8 text-center">{labels.drawn}</TableHead>
            <TableHead className="w-8 text-center">{labels.lost}</TableHead>
            <TableHead className="w-8 text-center">{labels.goalsFor}</TableHead>
            <TableHead className="w-8 text-center">{labels.goalsAgainst}</TableHead>
            <TableHead className="w-8 text-center">{labels.goalDiff}</TableHead>
            <TableHead className="w-8 text-center font-bold">{labels.points}</TableHead>
            <TableHead className="hidden sm:table-cell">{labels.form}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((row) => (
            <TableRow key={row.rank} className="hover:bg-secondary/30">
              <TableCell className="text-center text-xs font-medium text-muted-foreground">
                {row.rank}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Image src={row.team.logo} alt={row.team.name} width={20} height={20} className="shrink-0" />
                  <span className="text-sm font-medium truncate">{row.team.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-center text-sm">{row.all.played}</TableCell>
              <TableCell className="text-center text-sm">{row.all.win}</TableCell>
              <TableCell className="text-center text-sm">{row.all.draw}</TableCell>
              <TableCell className="text-center text-sm">{row.all.lose}</TableCell>
              <TableCell className="text-center text-sm">{row.all.goals.for}</TableCell>
              <TableCell className="text-center text-sm">{row.all.goals.against}</TableCell>
              <TableCell className={cn("text-center text-sm", row.goalsDiff > 0 && "text-win", row.goalsDiff < 0 && "text-loss")}>
                {row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}
              </TableCell>
              <TableCell className="text-center text-sm font-bold">{row.points}</TableCell>
              <TableCell className="hidden sm:table-cell">
                <FormBadges form={row.form} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
