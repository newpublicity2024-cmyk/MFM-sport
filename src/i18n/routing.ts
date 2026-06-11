import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "fr", "en"],
  defaultLocale: "ar",
  // Always land first-time visitors on Arabic instead of negotiating from the
  // browser's Accept-Language header. Users can still switch via the language
  // picker (which navigates to the /fr or /en prefix).
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
