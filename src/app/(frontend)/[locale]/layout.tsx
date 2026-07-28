import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Locale shell: direction, font class, translations. Nothing visual, and
 * deliberately nothing that renders an ad.
 *
 * The header, footer and every ad unit live one level down in
 * (site)/layout.tsx, and all real pages sit inside that route group.
 * not-found.tsx is a sibling of the group rather than a child, so raising
 * `notFound()` discards the entire (site) subtree — ads included — and renders
 * its own chrome instead. That makes "no ads on error pages" structural rather
 * than a convention someone has to remember, which matters because Google
 * prohibits ads on screens without publisher content and GA4 showed error pages
 * were the largest single bucket of views on this site.
 *
 * Route groups are erased from the URL, so /ar/articles is unaffected.
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const fontClass = locale === "ar" ? "font-arabic" : "font-sans";

  return (
    <div dir={direction} lang={locale} className={`${fontClass} min-h-screen flex flex-col`}>
      <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
    </div>
  );
}
