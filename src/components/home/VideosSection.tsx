"use client";

import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { VideoPlayer } from "./VideoPlayer";
import { VideoList } from "./VideoList";
import type { HomeVideo } from "@/lib/videos";

type Props = {
  title: string;
  locale: string;
  videos: HomeVideo[];
};

export function VideosSection({ title, locale, videos }: Props) {
  const [selectedId, setSelectedId] = useState<string>(videos[0]?.youtubeId ?? "");

  const selected = useMemo(
    () => videos.find((v) => v.youtubeId === selectedId) ?? videos[0],
    [selectedId, videos],
  );

  if (!selected) return null;

  return (
    <section className="mt-10">
      <SectionHeader title={title} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VideoPlayer videoId={selected.youtubeId} title={selected.title} />
        </div>
        <div>
          <VideoList
            videos={videos}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </section>
  );
}
