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

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <a
              href="/ar"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-neutral-900 text-white hover:bg-neutral-700 transition-colors font-medium"
            >
              الصفحة الرئيسية
            </a>
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
