import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // The site is Arabic-only on the front end. French/English translation data is
  // kept in Payload (reversible) but no longer exposed: /fr and /en are 301'd to
  // /ar in middleware, and the language switcher is removed. To re-enable a
  // locale, add it back here and restore the switcher.
  locales: ["ar"],
  defaultLocale: "ar",
  // Always land first-time visitors on Arabic instead of negotiating from the
  // browser's Accept-Language header.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
