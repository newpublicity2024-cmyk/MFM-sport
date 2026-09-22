"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { PollChoice, PollCounts } from "@/lib/poll/store";

export type WinnerPollLabels = {
  title: string;
  draw: string;
  vote: string;
  thanks: string;
  closed: string;
  votes: string;
  error: string;
};

type Team = { id: number; name: string; logo: string };

type Props = {
  fixtureId: number;
  home: Team;
  away: Team;
  homeName: string;
  awayName: string;
  labels: WinnerPollLabels;
  /** Server-computed from the fixture's status and kick-off: the UI mirrors the rule. */
  open: boolean;
};

type PollState = {
  available: boolean;
  percentages?: PollCounts;
  total?: number;
  myVote?: PollChoice | null;
};

/**
 * "Who will win?" — three choices, one vote per visitor.
 *
 * A client island on purpose: the counts are volatile and per-visitor, so
 * they must never enter the server HTML (that would make the page uncacheable
 * and put a changing number in front of a crawler). The container reserves its
 * height, so the late fetch does not shift the page.
 */
export function WinnerPoll({ fixtureId, home, away, homeName, awayName, labels, open }: Props) {
  const [state, setState] = useState<PollState | null>(null);
  const [pending, setPending] = useState<PollChoice | null>(null);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const ctrl = new AbortController();
    fetch(`/api/matches/${fixtureId}/poll`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: PollState) => mounted.current && setState(data))
      .catch(() => mounted.current && setState({ available: false }));
    return () => {
      mounted.current = false;
      ctrl.abort();
    };
  }, [fixtureId]);

  const vote = useCallback(
    async (choice: PollChoice) => {
      if (!open || pending || state?.myVote) return;
      setPending(choice);
      setFailed(false);
      try {
        const res = await fetch(`/api/matches/${fixtureId}/poll`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ choice }),
        });
        const data: PollState = await res.json();
        if (!res.ok && res.status !== 409) throw new Error(String(res.status));
        if (mounted.current) setState(data);
      } catch {
        if (mounted.current) setFailed(true);
      } finally {
        if (mounted.current) setPending(null);
      }
    },
    [fixtureId, open, pending, state?.myVote],
  );

  // Nothing to offer and nothing to show: stay out of the page entirely.
  if (state && !state.available) return null;

  const voted = state?.myVote ?? null;
  const showResults = voted != null || !open;
  const pct = state?.percentages;

  const choices: { key: PollChoice; label: string; logo?: string }[] = [
    { key: "home", label: homeName, logo: home.logo },
    { key: "draw", label: labels.draw },
    { key: "away", label: awayName, logo: away.logo },
  ];

  return (
    <section
      data-block="poll"
      aria-labelledby="winner-poll-heading"
      className="mb-8 bg-card rounded-lg border border-border p-4 min-h-[188px]"
    >
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 id="winner-poll-heading" className="text-base font-bold">
          {labels.title}
        </h2>
        {showResults && state?.total != null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {state.total} {labels.votes}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="winner-poll-heading">
        {choices.map(({ key, label, logo }) => {
          const share = pct?.[key];
          const isMine = voted === key;
          return (
            <button
              key={key}
              type="button"
              data-choice={key}
              aria-pressed={isMine}
              disabled={!open || voted != null || pending != null}
              onClick={() => vote(key)}
              className={cn(
                "relative overflow-hidden rounded-lg border p-3 text-center transition-colors",
                "disabled:cursor-default",
                isMine ? "border-primary bg-primary/5" : "border-border",
                open && !voted && "hover:border-primary/40 hover:bg-secondary/40",
              )}
            >
              {showResults && share != null && (
                <span
                  aria-hidden="true"
                  className={cn("absolute inset-y-0 start-0", isMine ? "bg-primary/15" : "bg-secondary")}
                  style={{ width: `${share}%` }}
                />
              )}
              <span className="relative flex flex-col items-center gap-1.5">
                {logo ? (
                  <Image src={logo} alt="" width={28} height={28} />
                ) : (
                  <span className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                    =
                  </span>
                )}
                <span className="text-xs font-medium truncate max-w-full">{label}</span>
                {showResults && share != null && (
                  <span className="text-sm font-bold tabular-nums" data-share={share}>
                    {share}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground" role="status">
        {failed ? labels.error : !open ? labels.closed : voted ? labels.thanks : labels.vote}
      </p>
    </section>
  );
}
