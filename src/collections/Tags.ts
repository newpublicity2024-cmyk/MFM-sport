import type { CollectionConfig } from "payload";

export const Tags: CollectionConfig = {
  slug: "tags",
  labels: {
    singular: { en: "Tag", fr: "Étiquette", ar: "وسم" },
    plural: { en: "Tags", fr: "Étiquettes", ar: "الوسوم" },
  },
  admin: {
    useAsTitle: "name",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      localized: true,
      label: { en: "Name", fr: "Nom", ar: "الاسم" },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      label: { en: "Slug", fr: "Identifiant URL", ar: "المعرّف في الرابط" },
    },
  ],
};
