import type { CollectionConfig } from "payload";

export const Redirects: CollectionConfig = {
  slug: "redirects",
  labels: {
    singular: { en: "Redirect", fr: "Redirection", ar: "إعادة توجيه" },
    plural: { en: "Redirects", fr: "Redirections", ar: "عمليات إعادة التوجيه" },
  },
  admin: {
    defaultColumns: ["from", "to", "statusCode"],
    description: {
      en: "Legacy URL redirects (WordPress migration)",
      fr: "Redirections des anciennes URL (migration WordPress)",
      ar: "إعادة توجيه الروابط القديمة (ترحيل ووردبريس)",
    },
  },
  fields: [
    {
      name: "from",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: { en: "From (old path)", fr: "Depuis (ancien chemin)", ar: "من (المسار القديم)" },
      admin: {
        description: {
          en: "Old path (e.g., /%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1-old-slug/)",
          fr: "Ancien chemin (ex. : /%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1-old-slug/)",
          ar: "المسار القديم (مثال: /%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1-old-slug/)",
        },
      },
    },
    {
      name: "to",
      type: "text",
      required: true,
      label: { en: "To (new path)", fr: "Vers (nouveau chemin)", ar: "إلى (المسار الجديد)" },
      admin: {
        description: {
          en: "New path (e.g., /ar/articles/new-slug)",
          fr: "Nouveau chemin (ex. : /ar/articles/new-slug)",
          ar: "المسار الجديد (مثال: /ar/articles/new-slug)",
        },
      },
    },
    {
      name: "statusCode",
      type: "select",
      required: true,
      defaultValue: "301",
      label: { en: "Status code", fr: "Code de statut", ar: "رمز الحالة" },
      options: [
        { label: { en: "301 Permanent", fr: "301 Permanente", ar: "301 دائمة" }, value: "301" },
        { label: { en: "302 Temporary", fr: "302 Temporaire", ar: "302 مؤقتة" }, value: "302" },
      ],
    },
  ],
};
