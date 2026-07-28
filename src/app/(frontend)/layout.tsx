import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import React from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { AdHeadInjector } from "@/components/ads/AdHeadInjector";
import { getAdHeadCodes } from "@/lib/payload/ads";
import { SITE_URL } from "@/lib/seo/siteUrl";
import "./styles.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export const metadata: Metadata = {
  // Normalised to the www origin the site actually serves on — see lib/seo/siteUrl.
  // Every canonical, hreflang and og:url on the site derives from this.
  metadataBase: new URL(SITE_URL),
  title: "MFM Sport",
  // Arabic, because the site is Arabic. This is the fallback description for any
  // page type that doesn't set its own; it used to read "Moroccan Football News
  // Portal" — English boilerplate served on every page including articles' own
  // og:description, which is a wasted snippet on every SERP the site appears in.
  description:
    "آخر أخبار الكرة المغربية: البطولة الاحترافية، المنتخب المغربي، الوداد والرجاء، دوري أبطال أفريقيا، نتائج المباريات وترتيب الفرق مباشرة على إم إف إم سبور.",
  // AdSense site verification: emits <meta name="google-adsense-account"> so
  // Google can confirm ownership during review. Present only once the client ID
  // is configured; complements the adsbygoogle loader below.
  ...(adsenseClientId && {
    other: { "google-adsense-account": adsenseClientId },
  }),
};

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const adHeadCodes = await getAdHeadCodes();
  return (
    <html suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexArabic.variable} font-sans antialiased`}
      >
        {/* Per-ad header snippets pasted in the admin, injected once site-wide.
            Rendered first + server-side so they parse/execute before any ad body
            (e.g. a GPT body's googletag.display) runs in a client effect. */}
        <AdHeadInjector codes={adHeadCodes} />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        {/* The AdSense loader deliberately lives in [locale]/layout.tsx, NOT here.
            This layout also wraps not-found.tsx, and Google's policy prohibits ads
            on screens without publisher content. GA4 showed >50% of all page views
            were error pages, every one of them carrying Auto Ads. Keeping the
            loader one level down means real pages get ads and 404s never do. */}
        <GoogleAnalytics />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
