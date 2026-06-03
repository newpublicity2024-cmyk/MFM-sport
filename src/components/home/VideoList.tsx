"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { HomeVideo } from "@/lib/videos";

type Props = {
  videos: HomeVideo[];
  selectedId: string;
  locale: string;
  onSelect: (videoId: string) => void;
};

export function VideoList({ videos, selectedId, locale, onSelect }: Props) {
  return (
    <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-2 lg:h-full lg:max-h-none">
      {videos.map((video) => {
        const isActive = video.youtubeId === selectedId;
        return (
          <button
            key={video.youtubeId}
            type="button"
            onClick={() => onSelect(video.youtubeId)}
            aria-pressed={isActive}
            className={`flex items-stretch gap-2 rounded-lg p-1.5 text-start transition-colors ${
              isActive
                ? "bg-primary/10 ring-1 ring-primary"
                : "hover:bg-white/10"
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
                  <Play className="h-5 w-5 fill-white stroke-white" />
                </div>
              )}
              <span className="absolute bottom-0.5 end-0.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                {video.duration}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-between py-0.5">
              <span className="text-xs font-medium leading-snug line-clamp-2">
                {video.title}
              </span>
              {video.publishedAt && (
                <time
                  dateTime={video.publishedAt}
                  className="text-[10px] text-white/60"
                >
                  {formatDate(video.publishedAt, locale)}
                </time>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
