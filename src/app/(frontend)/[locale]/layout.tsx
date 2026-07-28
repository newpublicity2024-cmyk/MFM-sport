import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AdSlot } from "@/components/ads/AdSlot";
import { StickyMobileAd } from "@/components/ads/StickyMobileAd";
import { SocialFloater } from "@/components/social/SocialFloater";

const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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
      <NextIntlClientProvider messages={messages}>
        <div className="container pt-2">
          <AdSlot slotName="headerLeaderboard" format="leaderboard" loading="eager" />
        </div>
        <Header locale={locale} />
        <main className="flex-1">{children}</main>
        <Footer locale={locale} />
        <StickyMobileAd />
        <SocialFloater />
      </NextIntlClientProvider>
      {/* AdSense loader, exactly as Google provides it. React 19 hoists this
          async <script> into <head> and dedupes it — the placement Auto Ads
          expects. One tag only; loading adsbygoogle.js twice throws AdSense errors.
          Powers both Auto Ads (dashboard toggle) and manual AdSlot units.
          Lives here rather than in the parent (frontend)/layout.tsx so that
          not-found.tsx — which renders outside this segment — serves no ads. */}
      {adsenseClientId && (
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
          crossOrigin="anonymous"
        />
      )}
    </div>
  );
}
