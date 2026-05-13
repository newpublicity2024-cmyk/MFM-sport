"use client";

import { useMemo, useState } from "react";
import type { MockLocaleString } from "@/lib/home/mockLeagueNews";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { VideoPlayer } from "./VideoPlayer";
import { VideoList } from "./VideoList";
import { MOCK_VIDEOS } from "@/lib/home/mockVideos";

type Props = {
  title: string;
  locale: string;
};

function pickTitle(title: MockLocaleString, locale: string): string {
  if (locale === "ar") return title.ar;
  if (locale === "fr") return title.fr;
  return title.en;
}

export function VideosSection({ title, locale }: Props) {
  const [selectedId, setSelectedId] = useState<string>(MOCK_VIDEOS[0]?.id ?? "");

  const selected = useMemo(
    () => MOCK_VIDEOS.find((v) => v.id === selectedId) ?? MOCK_VIDEOS[0],
    [selectedId],
  );

  if (!selected) return null;

  return (
    <section className="mt-10">
      <SectionHeader title={title} />
      <div className="grid grid-cols-1 gap-4 lg:h-[500px] lg:grid-cols-3">
        <div className="lg:col-span-2 lg:h-full">
          <VideoPlayer videoId={selected.id} title={pickTitle(selected.title, locale)} />
        </div>
        <div className="lg:h-full overflow-y-auto">
          <VideoList
            videos={MOCK_VIDEOS}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </section>
  );
}
