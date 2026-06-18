import type { CollectionConfig } from "payload";

export const Clubs: CollectionConfig = {
  slug: "clubs",
  labels: {
    singular: { en: "Club", fr: "Club", ar: "نادٍ" },
    plural: { en: "Clubs", fr: "Clubs", ar: "الأندية" },
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "country", "apiFootballId"],
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
      name: "logo",
      type: "upload",
      relationTo: "media",
      label: { en: "Logo", fr: "Logo", ar: "الشعار" },
    },
    {
      name: "logoUrl",
      type: "text",
      label: { en: "Logo URL", fr: "URL du logo", ar: "رابط الشعار" },
      admin: {
        description: {
          en: "Optional external logo URL fallback (used when 'logo' upload is empty). Useful for seeded preview data referencing API-Football's CDN.",
          fr: "URL de logo externe facultative (utilisée quand le champ « Logo » est vide). Utile pour les données de prévisualisation issues du CDN d'API-Football.",
          ar: "رابط شعار خارجي اختياري (يُستخدم عندما يكون حقل «الشعار» فارغًا). مفيد لبيانات المعاينة المرتبطة بشبكة API-Football.",
        },
      },
    },
    {
      name: "apiFootballId",
      type: "number",
      unique: true,
      label: { en: "API-Football ID", fr: "Identifiant API-Football", ar: "معرّف API-Football" },
      admin: {
        description: {
          en: "Team ID from API-Football",
          fr: "Identifiant de l'équipe dans API-Football",
          ar: "معرّف الفريق في API-Football",
        },
      },
    },
    {
      name: "competitions",
      type: "relationship",
      relationTo: "competitions",
      hasMany: true,
      label: { en: "Competitions", fr: "Compétitions", ar: "البطولات" },
    },
    {
      name: "venue",
      type: "text",
      localized: true,
      label: { en: "Venue", fr: "Stade", ar: "الملعب" },
    },
    {
      name: "country",
      type: "text",
      label: { en: "Country", fr: "Pays", ar: "البلد" },
    },
  ],
};
