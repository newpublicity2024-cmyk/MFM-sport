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

/**
 * Chrome for every real page: header, footer, and every ad unit on the site.
 *
 * This route group exists to draw one boundary. Everything that serves an ad is
 * inside it; not-found.tsx is outside it. Raising `notFound()` therefore
 * discards this whole subtree, so an error page cannot render an ad even by
 * accident. Google prohibits ads on screens without publisher content, and GA4
 * measured 5,523 of 11k page views as error pages — every one of them serving
 * Auto Ads before this split.
 *
 * The element order here is load-bearing: the leaderboard sits above the header,
 * as it did when this markup lived in [locale]/layout.tsx. Route groups are
 * erased from the URL, so paths are unchanged.
 */
export default async function SiteLayout({ children, params }: Props) {
  const { locale } = await params;

  return (
    <>
      <div className="container pt-2">
        <AdSlot slotName="headerLeaderboard" format="leaderboard" loading="eager" />
      </div>
      <Header locale={locale} />
      <main className="flex-1">{children}</main>
      <Footer locale={locale} />
      <StickyMobileAd />
      <SocialFloater />

      {/* AdSense loader, exactly as Google provides it. React 19 hoists this
          async <script> into <head> and dedupes it — the placement Auto Ads
          expects. One tag only; loading adsbygoogle.js twice throws AdSense
          errors. Powers both Auto Ads (dashboard toggle) and manual AdSlot units. */}
      {adsenseClientId && (
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
          crossOrigin="anonymous"
        />
      )}
    </>
  );
}
