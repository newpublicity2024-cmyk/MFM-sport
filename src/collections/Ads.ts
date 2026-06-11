import type { CollectionConfig } from "payload";

// The ad placement slots. Keep these values in sync with
// AdPlacement in src/lib/payload/ads.ts.
export const AD_PLACEMENTS = [
  { label: "Home — Top banner (above hero)", value: "top-banner" },
  { label: "Home — Between hero & news", value: "hero-news" },
  { label: "Home — Between news & videos", value: "news-videos" },
  { label: "Home — Between videos & matches", value: "videos-matches" },
  { label: "News card (blog-sized, in the news grid)", value: "news-card" },
  { label: "Article page — Side rail (vertical 300×600)", value: "article-sidebar" },
] as const;

export const Ads: CollectionConfig = {
  slug: "ads",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "type", "placement", "active", "order"],
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
      name: "type",
      type: "select",
      required: true,
      defaultValue: "image",
      options: [
        { label: "Image upload (static creative we host)", value: "image" },
        { label: "Ad-manager tag (embed code — network fills the slot)", value: "tag" },
      ],
      admin: {
        description:
          "Image = upload a creative. Ad-manager tag = paste an embed snippet from your network (Google Ad Manager, AdSense, etc.) and it fills the slot automatically.",
      },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      admin: {
        condition: (_, siblingData) => siblingData?.type !== "tag",
        description:
          "Banners: design ~1600×376 (wide). News cards: design 16:9 (e.g. 600×400). Article side rail: design 300×600 (vertical). Only used for Image-type ads.",
      },
      validate: (value, { siblingData }) => {
        const t = (siblingData as { type?: string })?.type;
        if (t !== "tag" && !value) return "An image is required for image-type ads.";
        return true;
      },
    },
    {
      name: "embedCode",
      type: "textarea",
      admin: {
        condition: (_, siblingData) => siblingData?.type === "tag",
        description:
          "Paste the full ad snippet from your network (the <ins>/<script> code). It runs as-is and the network fills the slot. Leave Image empty for tag ads.",
      },
      validate: (value, { siblingData }) => {
        const t = (siblingData as { type?: string })?.type;
        if (t === "tag" && (typeof value !== "string" || !value.trim())) {
          return "Paste the ad-manager embed code for tag-type ads.";
        }
        return true;
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
