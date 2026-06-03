"use client";

import { useMemo } from "react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { HomeMatchRow, type HomeMatchLabels } from "./HomeMatchRow";
import { SectionShell } from "@/components/home/SectionShell";
import { useLiveFixtures } from "@/hooks/useLiveFixtures";
import { getMatchStatus, type ApiFixture } from "@/lib/api-football/types";

type Props = {
  title: string;
  emptyLabel: string;
  locale: string;
  fixtures: ApiFixture[];
  labels: HomeMatchLabels;
};

const STATUS_RANK: Record<string, number> = { live: 0, scheduled: 1, finished: 2, other: 3 };

export function HomeMatchesSection({ title, emptyLabel, locale, fixtures, labels }: Props) {
  const { fixtures: liveFixtures } = useLiveFixtures({
    initial: [],
    intervalMs: 60000,
    enabled: true,
  });

  const merged = useMemo(() => {
    if (liveFixtures.length === 0) return fixtures;
    const liveMap = new Map(liveFixtures.map((f) => [f.fixture.id, f]));
    return fixtures.map((f) => liveMap.get(f.fixture.id) ?? f);
  }, [fixtures, liveFixtures]);

  const sorted = useMemo(() => {
    return [...merged]
      .sort((a, b) => {
        const ra = STATUS_RANK[getMatchStatus(a.fixture.status.short)] ?? 3;
        const rb = STATUS_RANK[getMatchStatus(b.fixture.status.short)] ?? 3;
        if (ra !== rb) return ra - rb;
        return a.fixture.timestamp - b.fixture.timestamp;
      })
      .slice(0, 12);
  }, [merged]);

  const firstLiveId = useMemo(
    () =>
      sorted.find((f) => getMatchStatus(f.fixture.status.short) === "live")?.fixture.id ?? null,
    [sorted],
  );

  return (
    <SectionShell>
      <SectionHeader title={title} />
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((f) => (
            <HomeMatchRow
              key={f.fixture.id}
              fixture={f}
              locale={locale}
              labels={labels}
              defaultOpen={f.fixture.id === firstLiveId}
            />
          ))}
        </div>
      )}
    </SectionShell>
  );
}
