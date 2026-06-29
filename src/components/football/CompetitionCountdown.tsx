"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

type Labels = {
  startsIn: string;
  firstMatch: string;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

type Props = { targetIso: string; locale: string; labels: Labels };

function remaining(target: number, now: number) {
  const ms = Math.max(0, target - now);
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export function CompetitionCountdown({ targetIso, locale, labels }: Props) {
  const target = new Date(targetIso).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const r = remaining(target, now);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-6 text-center">
      <p className="text-sm text-muted-foreground">{labels.startsIn}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums" dir="ltr">
        {r.days}
        {labels.days} {pad(r.hours)}
        {labels.hours}:{pad(r.minutes)}
        {labels.minutes}:{pad(r.seconds)}
        {labels.seconds}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        {labels.firstMatch}: {formatDate(targetIso, locale)}
      </p>
    </div>
  );
}
