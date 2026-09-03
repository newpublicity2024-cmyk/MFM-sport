import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./(frontend)/styles.css";

/**
 * The 404 served for URLs that match no route at all — which, on this site, means
 * essentially every legacy WordPress URL still circulating in Google's index and
 * in inbound links.
 *
 * It exists for two reasons:
 *
 *  1. Branding. Unmatched URLs bypass route-group not-found files entirely, so
 *     these visitors were getting Next's unstyled "404: This page could not be
 *     found." — in English, on an Arabic site, for the single largest bucket of
 *     traffic the site receives.
 *  2. No ads. This renders its own document and never enters [locale]/layout.tsx,
 *     so the AdSense loader is structurally absent. Google prohibits ads on
 *     screens without publisher content.
 *
 * It must render a complete <html>/<body> — there is no root layout above it.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "الصفحة غير موجودة | MFM Sport",
  description: "الصفحة التي تبحث عنها غير متوفرة على موقع إم إف إم سبور.",
  // No `robots` here: Next emits <meta name="robots" content="noindex"> on
  // not-found renders automatically, and declaring it again just duplicates the tag.
};

export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${plexArabic.variable} font-arabic antialiased`}>
        <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
          <p className="text-sm font-medium tracking-widest text-neutral-500">404</p>

          <h1 className="text-[clamp(1.5rem,4vw+1rem,2.25rem)] font-bold">
            الصفحة غير موجودة
          </h1>

          <p className="text-neutral-600 max-w-md">
            ربما تم حذف الصفحة أو تغيير عنوانها. يمكنك العودة إلى الصفحة الرئيسية أو تصفح آخر الأخبار.
          </p>

          {/*
            Plain <a>, not next/link, and deliberately so.

            This document renders outside the App Router tree — see the note at
            the top of the file: there is no root layout above it and it emits
            its own <html>/<body>. next/link exists to navigate *within* a
            mounted router; from here there is no router to navigate within, so
            leaving this page has to be a full document load. That is also what
            we want behaviourally: the visitor should exit the error document
            and enter the real app shell, not soft-navigate inside a 404.

            @next/next/no-html-link-for-pages cannot see any of that — it only
            matches an href against the route manifest — so it reports these two
            as errors. Silenced per-line rather than per-file so a genuinely
            wrong <a> added here later still gets caught.
          */}
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/ar"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 transition-colors font-medium"
            >
              الصفحة الرئيسية
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/ar/articles"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md border border-neutral-300 hover:border-neutral-500 transition-colors font-medium"
            >
              آخر الأخبار
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
