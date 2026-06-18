// src/lib/payload/ads.ts
import { cache } from "react";
import type { Ad, Config } from "@/payload-types";
import { getImageAlt } from "@/lib/utils";

type Locale = Config["locale"];

export type AdPlacement =
  | "top-banner"
  | "hero-news"
  | "news-videos"
  | "videos-matches"
  | "news-card"
  | "article-sidebar";

export const AD_PLACEMENTS: AdPlacement[] = [
  "top-banner",
  "hero-news",
  "news-videos",
  "videos-matches",
  "news-card",
  "article-sidebar",
];

export type AdItem = {
  id: number | string;
  type: "image" | "tag";
  imageUrl?: string;
  alt?: string;
  linkUrl?: string;
  embedCode?: string;
};

export type AdsByPlacement = Record<AdPlacement, AdItem[]>;

function emptyGroups(): AdsByPlacement {
  return {
    "top-banner": [],
    "hero-news": [],
    "news-videos": [],
    "videos-matches": [],
    "news-card": [],
    "article-sidebar": [],
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

    // A tag ad owns its slot: no image, the network fills it via the snippet.
    if (ad.type === "tag") {
      const embedCode = ad.embedCode?.trim();
      if (!embedCode) continue;
      groups[placement].push({ id: ad.id, type: "tag", embedCode });
      continue;
    }

    // Image ad (the default; legacy rows have no `type`).
    const imageUrl = adImageUrl(ad.image);
    if (!imageUrl) continue;
    groups[placement].push({
      id: ad.id,
      type: "image",
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

// Distinct, non-empty header snippets across all active tag ads. These are the
// "header" halves the team pastes per ad; they're injected once site-wide (the
// root layout), deduped so identical loaders don't load twice. Fails open to [].
export const getAdHeadCodes = cache(async (): Promise<string[]> => {
  try {
    const { getPayloadClient } = await import("./queries");
    const payload = await getPayloadClient();
    const res = await payload.find({
      collection: "ads",
      where: { active: { equals: true }, type: { equals: "tag" } },
      depth: 0,
      limit: 100,
      select: { headCode: true },
    });
    const seen = new Set<string>();
    for (const ad of res.docs as Ad[]) {
      const code = ad.headCode?.trim();
      if (code) seen.add(code);
    }
    return [...seen];
  } catch (error) {
    console.error("[ads] getAdHeadCodes failed, returning []:", error);
    return [];
  }
});
