import type { CollectionConfig } from "payload";

export const Authors: CollectionConfig = {
  slug: "authors",
  labels: {
    singular: { en: "Author", fr: "Auteur", ar: "كاتب" },
    plural: { en: "Authors", fr: "Auteurs", ar: "الكُتّاب" },
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
    {
      name: "bio",
      type: "textarea",
      localized: true,
      label: { en: "Biography", fr: "Biographie", ar: "نبذة تعريفية" },
    },
    {
      name: "avatar",
      type: "upload",
      relationTo: "media",
      label: { en: "Avatar", fr: "Photo de profil", ar: "الصورة الشخصية" },
    },
    {
      name: "social",
      type: "group",
      label: { en: "Social links", fr: "Réseaux sociaux", ar: "روابط التواصل الاجتماعي" },
      fields: [
        { name: "twitter", type: "text", label: { en: "Twitter", fr: "Twitter", ar: "تويتر" } },
        { name: "facebook", type: "text", label: { en: "Facebook", fr: "Facebook", ar: "فيسبوك" } },
        { name: "instagram", type: "text", label: { en: "Instagram", fr: "Instagram", ar: "إنستغرام" } },
      ],
    },
  ],
};
