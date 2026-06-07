import type { CollectionConfig } from "payload";

// The five placeholder slots. Keep these values in sync with
// AdPlacement in src/lib/payload/ads.ts.
export const AD_PLACEMENTS = [
  { label: "Home — Top banner (above hero)", value: "top-banner" },
  { label: "Home — Between hero & news", value: "hero-news" },
  { label: "Home — Between news & videos", value: "news-videos" },
  { label: "Home — Between videos & matches", value: "videos-matches" },
  { label: "News card (blog-sized, in the news grid)", value: "news-card" },
] as const;

export const Ads: CollectionConfig = {
  slug: "ads",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "placement", "active", "order"],
    description:
      "Each row is one ad creative. Multiple ads sharing a placement rotate as a slider in that slot.",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      admin: { description: "Internal label (e.g. 'OCP SIAM — June')." },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      required: true,
      admin: {
        description:
          "Banners: design ~1600×376 (wide). News cards: design 16:9 (e.g. 600×400).",
      },
    },
    {
      name: "linkUrl",
      type: "text",
      admin: { description: "Optional. Clicking the ad opens this in a new tab." },
    },
    {
      name: "placement",
      type: "select",
      required: true,
      index: true,
      options: [...AD_PLACEMENTS],
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      index: true,
      admin: { description: "Uncheck to hide without deleting." },
    },
    {
      name: "order",
      type: "number",
      defaultValue: 0,
      admin: { description: "Lower shows first in the slider rotation." },
    },
  ],
};
