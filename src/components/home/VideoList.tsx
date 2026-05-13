"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { MockVideo } from "@/lib/home/mockVideos";

type Props = {
  videos: MockVideo[];
  selectedId: string;
  locale: string;
  onSelect: (videoId: string) => void;
};

function pickTitle(video: MockVideo, locale: string): string {
  if (locale === "ar") return video.title.ar;
  if (locale === "fr") return video.title.fr;
  return video.title.en;
}

export function VideoList({ videos, selectedId, locale, onSelect }: Props) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-card p-2">
      {videos.map((video) => {
        const isActive = video.id === selectedId;
        return (
          <button
            key={video.id}
            type="button"
            onClick={() => onSelect(video.id)}
            aria-pressed={isActive}
            className={`flex items-stretch gap-2 rounded-lg p-1.5 text-start transition-colors ${
              isActive
                ? "bg-primary/10 ring-1 ring-primary"
                : "hover:bg-muted/40"
            }`}
          >
            <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md">
              <Image
                src={video.thumbnailUrl}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
              />
              {isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-5 w-5 text-white" fill="white" />
                </div>
              )}
              <span className="absolute bottom-0.5 end-0.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                {video.duration}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-between py-0.5">
              <span className="text-xs font-medium leading-snug line-clamp-2">
                {pickTitle(video, locale)}
              </span>
              <time
                dateTime={video.publishedAt}
                className="text-[10px] text-muted-foreground"
              >
                {formatDate(video.publishedAt, locale)}
              </time>
            </div>
          </button>
        );
      })}
    </div>
  );
}
