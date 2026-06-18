import type { CollectionConfig } from "payload";

export const Competitions: CollectionConfig = {
  slug: "competitions",
  labels: {
    singular: { en: "Competition", fr: "Compétition", ar: "بطولة" },
    plural: { en: "Competitions", fr: "Compétitions", ar: "البطولات" },
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "type", "country", "apiFootballId"],
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
      name: "type",
      type: "select",
      required: true,
      label: { en: "Type", fr: "Type", ar: "النوع" },
      options: [
        { label: { en: "League", fr: "Championnat", ar: "دوري" }, value: "league" },
        { label: { en: "Cup", fr: "Coupe", ar: "كأس" }, value: "cup" },
      ],
    },
    {
      name: "country",
      type: "text",
      label: { en: "Country", fr: "Pays", ar: "البلد" },
    },
    {
      name: "apiFootballId",
      type: "number",
      required: true,
      unique: true,
      label: { en: "API-Football ID", fr: "Identifiant API-Football", ar: "معرّف API-Football" },
      admin: {
        description: {
          en: "League ID from API-Football (e.g., 39 for Premier League)",
          fr: "Identifiant de la ligue dans API-Football (ex. : 39 pour la Premier League)",
          ar: "معرّف الدوري في API-Football (مثال: 39 للدوري الإنجليزي الممتاز)",
        },
      },
    },
    {
      name: "season",
      type: "number",
      required: true,
      defaultValue: 2025,
      label: { en: "Season", fr: "Saison", ar: "الموسم" },
      admin: {
        description: {
          en: "Current season year (e.g., 2025 for 2025-26)",
          fr: "Année de la saison en cours (ex. : 2025 pour 2025-26)",
          ar: "سنة الموسم الحالي (مثال: 2025 لموسم 2025-26)",
        },
      },
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "categories",
      label: { en: "Category", fr: "Catégorie", ar: "التصنيف" },
      admin: {
        description: {
          en: "Links this competition to a news category for article filtering",
          fr: "Associe cette compétition à une catégorie d'actualités pour filtrer les articles",
          ar: "يربط هذه البطولة بتصنيف إخباري لتصفية المقالات",
        },
      },
    },
  ],
};
