import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import React from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AdHeadInjector } from "@/components/ads/AdHeadInjector";
import { getAdHeadCodes } from "@/lib/payload/ads";
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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://mfmsport.ma",
  ),
  title: "MFM Sport",
  description: "Moroccan Football News Portal",
};

const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const adHeadCodes = await getAdHeadCodes();
  return (
    <html suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexArabic.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        {adsenseClientId && (
          <Script
            id="adsbygoogle"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
        {/* Per-ad header snippets pasted in the admin, injected once site-wide. */}
        <AdHeadInjector codes={adHeadCodes} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
