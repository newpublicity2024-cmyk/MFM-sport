import Link from "next/link";
import type { Metadata } from "next";
import { NotFoundTracker } from "@/components/analytics/NotFoundTracker";

/**
 * The site's single 404 surface.
 *
 * It sits at the (frontend) group level, one segment ABOVE [locale]/layout.tsx,
 * for two deliberate reasons:
 *
 *  1. No ads. The locale layout renders the header leaderboard, the sticky
 *     mobile unit and the AdSense loader. Google prohibits ads on screens
 *     without publisher content, and GA4 showed error pages were the single
 *     largest "content" bucket on the site. Rendering 404s outside that layout
 *     means they cannot serve ads, structurally.
 *  2. One renderer instead of three. Previously a miss could surface as the
 *     catch-all soft-404, as `title: "Not Found"` from an article/fixture
 *     lookup, or as Next's built-in "404: This page could not be found." — all
 *     three appeared separately in analytics. Everything now lands here.
 *
 * The site is Arabic-only, so the copy is hardcoded rather than going through
 * next-intl, which is only available inside [locale].
 */
export const metadata: Metadata = {
  title: "الصفحة غير موجودة | MFM Sport",
  description: "الصفحة التي تبحث عنها غير متوفرة.",
  // No `robots` here: Next emits noindex on not-found renders automatically.
};

export default function NotFound() {
  return (
    <div dir="rtl" lang="ar" className="font-arabic min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <NotFoundTracker />

      <p className="text-sm font-medium tracking-wider text-muted-foreground mb-3">404</p>

      <h1 className="text-[clamp(1.5rem,4vw+1rem,2.25rem)] font-bold mb-4">
        الصفحة غير موجودة
      </h1>

      <p className="text-muted-foreground mb-8 max-w-md">
        ربما تم حذف الصفحة أو تغيير عنوانها. يمكنك العودة إلى الصفحة الرئيسية أو تصفح آخر الأخبار.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/ar"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        >
          الصفحة الرئيسية
        </Link>
        <Link
          href="/ar/articles"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-md border border-border bg-card hover:border-primary/30 transition-colors font-medium"
        >
          آخر الأخبار
        </Link>
      </div>
    </div>
  );
}
