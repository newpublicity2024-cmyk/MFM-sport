import Image from "next/image";
import type { ApiLineup } from "@/lib/api-football/types";

type Props = {
  lineup: ApiLineup;
  labels: { startingXI: string; substitutes: string; coach: string; formation: string };
};

export function MatchLineup({ lineup, labels }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src={lineup.team.logo} alt={lineup.team.name} width={24} height={24} />
          <span className="font-bold text-sm">{lineup.team.name}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {labels.formation}: {lineup.formation}
        </span>
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">{labels.startingXI}</h4>
        <div className="grid grid-cols-1 gap-1">
          {lineup.startXI.map((p) => (
            <div key={p.player.id} className="flex items-center gap-2 text-sm py-0.5">
              <span className="w-6 text-center text-xs text-muted-foreground font-mono">{p.player.number}</span>
              <span>{p.player.name}</span>
              <span className="text-[10px] text-muted-foreground">{p.player.pos}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">{labels.substitutes}</h4>
        <div className="grid grid-cols-1 gap-1">
          {lineup.substitutes.map((p) => (
            <div key={p.player.id} className="flex items-center gap-2 text-sm py-0.5 text-muted-foreground">
              <span className="w-6 text-center text-xs font-mono">{p.player.number}</span>
              <span>{p.player.name}</span>
            </div>
          ))}
        </div>
      </div>

      {lineup.coach?.name && (
        <div className="text-sm text-muted-foreground">
          {labels.coach}: <span className="text-foreground">{lineup.coach.name}</span>
        </div>
      )}
    </div>
  );
}
