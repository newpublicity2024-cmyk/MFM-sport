import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  upload: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    imageSizes: [
      {
        name: "thumbnail",
        width: 300,
        height: 200,
        position: "centre",
      },
      {
        name: "card",
        width: 600,
        height: 400,
        position: "centre",
      },
      {
        name: "hero",
        width: 1200,
        height: 630,
        position: "centre",
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "caption",
      type: "text",
      localized: true,
    },
    {
      name: "wpUrl",
      type: "text",
      unique: true,
      index: true,
      admin: {
        description: "Original WordPress URL - used for dedup during migration.",
        readOnly: true,
      },
    },
  ],
};
