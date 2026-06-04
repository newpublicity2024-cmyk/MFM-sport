import { cn } from "@/lib/utils";
import type { ApiEvent } from "@/lib/api-football/types";
import { localizePerson } from "@/lib/api-football/localize";

type Props = {
  events: ApiEvent[];
  homeTeamId: number;
  locale: string;
};

function EventIcon({ type, detail }: { type: string; detail: string }) {
  if (type === "Goal") return <span className="text-win">⚽</span>;
  if (type === "Card" && detail.includes("Yellow")) return <span className="text-draw">🟨</span>;
  if (type === "Card" && detail.includes("Red")) return <span className="text-loss">🟥</span>;
  if (type === "subst") return <span className="text-muted-foreground">🔄</span>;
  if (type === "Var") return <span className="text-muted-foreground">📺</span>;
  return <span>•</span>;
}

export function MatchEvents({ events, homeTeamId, locale }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-2">
      {events.map((event, i) => {
        const isHome = event.team.id === homeTeamId;
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 text-sm py-1 px-2 rounded",
              isHome ? "justify-start" : "justify-end",
            )}
          >
            {isHome && (
              <>
                <span className="text-xs text-muted-foreground w-8 shrink-0">
                  {event.time.elapsed}&apos;{event.time.extra ? `+${event.time.extra}` : ""}
                </span>
                <EventIcon type={event.type} detail={event.detail} />
                <span className="font-medium">
                  {localizePerson(event.player.id, event.player.name, locale)}
                </span>
                {event.assist.name && (
                  <span className="text-muted-foreground text-xs">
                    ({localizePerson(event.assist.id, event.assist.name, locale)})
                  </span>
                )}
              </>
            )}
            {!isHome && (
              <>
                {event.assist.name && (
                  <span className="text-muted-foreground text-xs">
                    ({localizePerson(event.assist.id, event.assist.name, locale)})
                  </span>
                )}
                <span className="font-medium">
                  {localizePerson(event.player.id, event.player.name, locale)}
                </span>
                <EventIcon type={event.type} detail={event.detail} />
                <span className="text-xs text-muted-foreground w-8 shrink-0 text-end">
                  {event.time.elapsed}&apos;{event.time.extra ? `+${event.time.extra}` : ""}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
