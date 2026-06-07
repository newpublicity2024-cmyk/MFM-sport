// src/lib/payload/ads.ts
import type { Ad, Config } from "@/payload-types";
import { getImageAlt, getImageUrl } from "@/lib/utils";

type Locale = Config["locale"];

export type AdPlacement =
  | "top-banner"
  | "hero-news"
  | "news-videos"
  | "videos-matches"
  | "news-card";

export const AD_PLACEMENTS: AdPlacement[] = [
  "top-banner",
  "hero-news",
  "news-videos",
  "videos-matches",
  "news-card",
];

export type AdItem = {
  id: number | string;
  imageUrl: string;
  alt: string;
  linkUrl?: string;
};

export type AdsByPlacement = Record<AdPlacement, AdItem[]>;

function emptyGroups(): AdsByPlacement {
  return {
    "top-banner": [],
    "hero-news": [],
    "news-videos": [],
    "videos-matches": [],
    "news-card": [],
  };
}

// Pure: turn populated Payload ad docs into AdItems grouped by placement.
export function groupAds(docs: Ad[]): AdsByPlacement {
  const groups = emptyGroups();
  for (const ad of docs) {
    const placement = ad.placement as AdPlacement;
    if (!groups[placement]) continue;
    const imageUrl = getImageUrl(ad.image, "hero") ?? getImageUrl(ad.image, "card");
    if (!imageUrl) continue;
    groups[placement].push({
      id: ad.id,
      imageUrl,
      alt: getImageAlt(ad.image) || ad.name,
      linkUrl: ad.linkUrl ?? undefined,
    });
  }
  return groups;
}

// Fetch all active ads for a locale, grouped by placement and ordered.
export async function getAds(locale: Locale): Promise<AdsByPlacement> {
  const { getPayloadClient } = await import("./queries");
  const payload = await getPayloadClient();
  const res = await payload.find({
    collection: "ads",
    where: { active: { equals: true } },
    locale,
    sort: "order",
    depth: 1,
    limit: 100,
  });
  return groupAds(res.docs as Ad[]);
}
