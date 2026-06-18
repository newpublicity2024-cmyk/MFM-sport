import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  labels: {
    singular: { en: "Media", fr: "Média", ar: "ملف وسائط" },
    plural: { en: "Media", fr: "Médias", ar: "الوسائط" },
  },
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
      label: { en: "Alt text", fr: "Texte alternatif", ar: "النص البديل" },
    },
    {
      name: "caption",
      type: "text",
      localized: true,
      label: { en: "Caption", fr: "Légende", ar: "التعليق" },
    },
    {
      name: "wpUrl",
      type: "text",
      unique: true,
      index: true,
      label: { en: "WordPress URL", fr: "URL WordPress", ar: "رابط ووردبريس" },
      admin: {
        description: {
          en: "Original WordPress URL - used for dedup during migration.",
          fr: "URL WordPress d'origine — utilisée pour éviter les doublons lors de la migration.",
          ar: "رابط ووردبريس الأصلي — يُستخدم لمنع التكرار أثناء الترحيل.",
        },
        readOnly: true,
      },
    },
  ],
};
