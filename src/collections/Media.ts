import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    // Media (uploaded images) are served to the public site via the REST
    // file endpoint (/api/media/file/...), which the browser hits directly
    // and which enforces collection access control. Payload's default read
    // requires auth, so anonymous visitors get 403 and images break. Open
    // read so uploaded assets are publicly viewable; writes stay protected.
    read: () => true,
  },
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
