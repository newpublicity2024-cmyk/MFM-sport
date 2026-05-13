"use client";

import { useMemo, useState } from "react";
import { LeaguesPanel } from "./LeaguesPanel";
import { NewsGrid2x2 } from "./NewsGrid2x2";
import { SectionHeader } from "@/components/shared/SectionHeader";
import {
  MOCK_LEAGUES,
  getArticlesForLeague,
} from "@/lib/home/mockLeagueNews";

type Props = {
  title: string;
  locale: string;
};

export function LeagueNewsSection({ title, locale }: Props) {
  const [selectedId, setSelectedId] = useState<string>(MOCK_LEAGUES[0]?.id ?? "");

  const articles = useMemo(
    () => getArticlesForLeague(selectedId),
    [selectedId],
  );

  return (
    <section className="mt-10">
      <SectionHeader title={title} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NewsGrid2x2 articles={articles} locale={locale} />
        </div>
        <div>
          <LeaguesPanel
            leagues={MOCK_LEAGUES}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </section>
  );
}
