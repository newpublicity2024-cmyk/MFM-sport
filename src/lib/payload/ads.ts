// src/lib/payload/ads.ts
import type { Ad, Config } from "@/payload-types";
import { getImageAlt } from "@/lib/utils";

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

// Ad creatives are pre-designed art, so use the ORIGINAL uploaded image, not a
// Payload size crop — the slot's object-cover does the only crop. Using a crop
// (e.g. hero 1200x630) would double-crop wide banners down to a center patch.
function adImageUrl(image: Ad["image"]): string | null {
  if (image && typeof image === "object" && typeof image.url === "string") {
    return image.url;
  }
  return null;
}

// Pure: turn populated Payload ad docs into AdItems grouped by placement.
export function groupAds(docs: Ad[]): AdsByPlacement {
  const groups = emptyGroups();
  for (const ad of docs) {
    const placement = ad.placement as AdPlacement;
    if (!groups[placement]) continue;
    const imageUrl = adImageUrl(ad.image);
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
