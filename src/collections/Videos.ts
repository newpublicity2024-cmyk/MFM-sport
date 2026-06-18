import type { CollectionConfig } from "payload";

export const Videos: CollectionConfig = {
  slug: "videos",
  labels: {
    singular: { en: "Video", fr: "Vidéo", ar: "فيديو" },
    plural: { en: "Videos", fr: "Vidéos", ar: "مقاطع الفيديو" },
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "playlist", "publishedAt"],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "youtubeId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: { en: "YouTube ID", fr: "Identifiant YouTube", ar: "معرّف يوتيوب" },
      admin: {
        description: {
          en: "The 11-character YouTube video ID.",
          fr: "L'identifiant de la vidéo YouTube (11 caractères).",
          ar: "معرّف فيديو يوتيوب المكوّن من 11 حرفًا.",
        },
      },
    },
    {
      name: "playlist",
      type: "select",
      required: true,
      index: true,
      label: { en: "Playlist", fr: "Liste de lecture", ar: "قائمة التشغيل" },
      options: [
        { label: { en: "The Third Half", fr: "La troisième mi-temps", ar: "الشوط الثالث" }, value: "the-third-half" },
        { label: { en: "From the Stadiums", fr: "Depuis les stades", ar: "من الملاعب الرياضية" }, value: "from-the-stadiums" },
      ],
    },
    {
      name: "title",
      type: "text",
      required: true,
      label: { en: "Title", fr: "Titre", ar: "العنوان" },
    },
    {
      name: "thumbnailUrl",
      type: "text",
      required: true,
      label: { en: "Thumbnail URL", fr: "URL de la miniature", ar: "رابط الصورة المصغّرة" },
    },
    {
      name: "duration",
      type: "text",
      label: { en: "Duration", fr: "Durée", ar: "المدة" },
    },
    {
      name: "publishedAt",
      type: "date",
      label: { en: "Published at", fr: "Date de publication", ar: "تاريخ النشر" },
    },
    {
      name: "sortOrder",
      type: "number",
      defaultValue: 0,
      label: { en: "Sort order", fr: "Ordre de tri", ar: "ترتيب العرض" },
      admin: {
        description: {
          en: "Lower = earlier. Set from playlist order on sync.",
          fr: "Plus petit = plus tôt. Défini selon l'ordre de la liste lors de la synchronisation.",
          ar: "الأصغر يظهر أولًا. يُضبط حسب ترتيب القائمة عند المزامنة.",
        },
      },
    },
  ],
};
