import type { MockLocaleString } from "./mockLeagueNews";

export type MockVideo = {
  id: string;
  title: MockLocaleString;
  thumbnailUrl: string;
  duration: string;
  publishedAt: string;
};

export const MOCK_VIDEOS: MockVideo[] = [
  {
    id: "X_Kw65rK39c",
    title: {
      en: "Morocco vs Niger — FIFA World Cup 26 CAF qualifier",
      ar: "المغرب ضد النيجر — تصفيات أفريقيا لكأس العالم 2026",
      fr: "Maroc vs Niger — qualifications CAF Coupe du Monde 26",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/X_Kw65rK39c/hqdefault.jpg",
    duration: "08:12",
    publishedAt: "2026-05-13T12:00:00.000Z",
  },
  {
    id: "oget_zdcFbU",
    title: {
      en: "Morocco vs Tanzania — AFCON 2025 extended highlights",
      ar: "المغرب ضد تنزانيا — ملخص موسع لكأس أمم أفريقيا 2025",
      fr: "Maroc vs Tanzanie — résumé étendu CAN 2025",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/oget_zdcFbU/hqdefault.jpg",
    duration: "05:45",
    publishedAt: "2026-05-11T12:00:00.000Z",
  },
  {
    id: "JXi07jEOb2w",
    title: {
      en: "Morocco vs Ecuador — extended highlights",
      ar: "المغرب ضد الإكوادور — ملخص موسع",
      fr: "Maroc vs Équateur — résumé étendu",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/JXi07jEOb2w/hqdefault.jpg",
    duration: "07:33",
    publishedAt: "2026-05-11T12:00:00.000Z",
  },
  {
    id: "0Albh96Ckxo",
    title: {
      en: "Senegal vs Morocco — AFCON 2025 highlights",
      ar: "السنغال ضد المغرب — ملخص كأس أمم أفريقيا 2025",
      fr: "Sénégal vs Maroc — résumé CAN 2025",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/0Albh96Ckxo/hqdefault.jpg",
    duration: "12:01",
    publishedAt: "2026-05-10T12:00:00.000Z",
  },
  {
    id: "ES4u5Mw_B10",
    title: {
      en: "Morocco vs Ethiopia — U17 Africa Cup of Nations 2026",
      ar: "المغرب ضد إثيوبيا — كأس أمم أفريقيا تحت 17 عامًا 2026",
      fr: "Maroc vs Éthiopie — CAN U17 2026",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/ES4u5Mw_B10/hqdefault.jpg",
    duration: "09:18",
    publishedAt: "2026-05-09T12:00:00.000Z",
  },
  {
    id: "PnWVPTbSjmk",
    title: {
      en: "Morocco vs Tunisia — U17 Africa Cup of Nations 2026",
      ar: "المغرب ضد تونس — كأس أمم أفريقيا تحت 17 عامًا 2026",
      fr: "Maroc vs Tunisie — CAN U17 2026",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/PnWVPTbSjmk/hqdefault.jpg",
    duration: "11:42",
    publishedAt: "2026-05-08T12:00:00.000Z",
  },
  {
    id: "79UtZlecRcc",
    title: {
      en: "Morocco vs Ecuador — full game highlights",
      ar: "المغرب ضد الإكوادور — ملخص المباراة كاملة",
      fr: "Maroc vs Équateur — résumé complet du match",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/79UtZlecRcc/hqdefault.jpg",
    duration: "06:27",
    publishedAt: "2026-05-07T12:00:00.000Z",
  },
];
