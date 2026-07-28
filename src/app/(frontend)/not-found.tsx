import Link from "next/link";
import type { Metadata } from "next";
import { NotFoundTracker } from "@/components/analytics/NotFoundTracker";

/**
 * The 404 for in-app `notFound()` — a missing article, category, tag, club,
 * author or fixture.
 *
 * It sits at the (frontend) group level, above [locale], for two reasons:
 *
 *  1. No ads. Every ad on the site is rendered by [locale]/(site)/layout.tsx.
 *     This file is outside that subtree, so a 404 cannot serve an ad even by
 *     accident. Google prohibits ads on screens without publisher content, and
 *     GA4 measured 5,523 of 11k page views as error pages — all serving Auto
 *     Ads before this split.
 *  2. It is where the boundary actually resolves. Entity routes raise
 *     `notFound()` inside `generateMetadata` (so the 404 status is set before
 *     the response streams), and metadata resolves above the [locale] segment
 *     tree — so a not-found.tsx placed inside [locale] is never reached. That
 *     is also why this page renders no header or footer: next-intl's message
 *     context only exists inside [locale].
 *
 * Unmatched URLs never get here; they never resolve a [locale] segment at all
 * and are served by app/global-not-found.tsx.
 *
 * The site is Arabic-only, so the copy is hardcoded.
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
