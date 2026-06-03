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
    <section className="mt-10 rounded-2xl bg-navy text-navy-foreground p-4 lg:p-6">
      <SectionHeader title={title} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch">
        <div className="lg:col-span-2">
          <VideoPlayer videoId={selected.youtubeId} title={selected.title} />
        </div>
        {/* Absolute-fill so the list matches the player's height at lg (do not flatten these two wrappers) */}
        <div className="lg:relative">
          <div className="lg:absolute lg:inset-0">
            <VideoList
              videos={videos}
              selectedId={selectedId}
              locale={locale}
              onSelect={setSelectedId}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
