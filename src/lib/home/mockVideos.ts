import type { MockLocaleString } from "./mockLeagueNews";

export type MockVideo = {
  id: string;
  title: MockLocaleString;
  thumbnailUrl: string;
  duration: string;
  publishedAt: string;
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const MOCK_VIDEOS: MockVideo[] = [
  {
    id: "dQw4w9WgXcQ",
    title: {
      en: "Match highlights: Raja vs Wydad",
      ar: "ملخص مباراة: الرجاء ضد الوداد",
      fr: "Résumé du match : Raja vs Wydad",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    duration: "10:24",
    publishedAt: daysAgo(0),
  },
  {
    id: "9bZkp7q19f0",
    title: {
      en: "Top 10 goals of the week",
      ar: "أفضل 10 أهداف هذا الأسبوع",
      fr: "Top 10 des buts de la semaine",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
    duration: "08:12",
    publishedAt: daysAgo(1),
  },
  {
    id: "kJQP7kiw5Fk",
    title: {
      en: "Post-match interview: AS FAR coach",
      ar: "تصريحات ما بعد المباراة: مدرب الجيش الملكي",
      fr: "Interview d'après-match : entraîneur de l'AS FAR",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
    duration: "05:45",
    publishedAt: daysAgo(2),
  },
  {
    id: "L_jWHffIx5E",
    title: {
      en: "Champions League: best saves",
      ar: "دوري الأبطال: أفضل التصديات",
      fr: "Ligue des champions : meilleurs arrêts",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/L_jWHffIx5E/hqdefault.jpg",
    duration: "07:33",
    publishedAt: daysAgo(2),
  },
  {
    id: "fJ9rUzIMcZQ",
    title: {
      en: "Tactical breakdown: Atlas Lions formation",
      ar: "تحليل تكتيكي: تشكيلة أسود الأطلس",
      fr: "Analyse tactique : la formation des Lions de l'Atlas",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
    duration: "12:01",
    publishedAt: daysAgo(3),
  },
  {
    id: "OPf0YbXqDm0",
    title: {
      en: "Hakimi: career moments",
      ar: "حكيمي: لحظات من المسيرة",
      fr: "Hakimi : moments de carrière",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg",
    duration: "09:18",
    publishedAt: daysAgo(4),
  },
  {
    id: "RgKAFK5djSk",
    title: {
      en: "Botola weekly recap",
      ar: "ملخص أسبوع البطولة",
      fr: "Résumé hebdomadaire de la Botola",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg",
    duration: "11:42",
    publishedAt: daysAgo(5),
  },
  {
    id: "JGwWNGJdvx8",
    title: {
      en: "Press conference: national team manager",
      ar: "ندوة صحفية: مدرب المنتخب",
      fr: "Conférence de presse : sélectionneur national",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
    duration: "06:27",
    publishedAt: daysAgo(6),
  },
];
