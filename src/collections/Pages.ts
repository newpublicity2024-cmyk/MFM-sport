import type { CollectionConfig } from "payload";

export const Pages: CollectionConfig = {
  slug: "pages",
  labels: {
    singular: { en: "Page", fr: "Page", ar: "صفحة" },
    plural: { en: "Pages", fr: "Pages", ar: "الصفحات" },
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug"],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
      label: { en: "Title", fr: "Titre", ar: "العنوان" },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      label: { en: "Slug", fr: "Identifiant URL", ar: "المعرّف في الرابط" },
      admin: {
        description: {
          en: "URL identifier: about, contact, legal, privacy",
          fr: "Identifiant d'URL : about, contact, legal, privacy",
          ar: "معرّف الرابط: about أو contact أو legal أو privacy",
        },
      },
    },
    {
      name: "body",
      type: "richText",
      required: true,
      localized: true,
      label: { en: "Body", fr: "Contenu", ar: "المحتوى" },
    },
  ],
};
