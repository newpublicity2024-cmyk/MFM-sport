"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
  }
}

/**
 * Fires a distinct GA4 event for every 404, carrying the requested path.
 *
 * Without this, 404s are indistinguishable from real traffic in GA4 — they show
 * up as ordinary page_views under whatever title the error page happens to
 * render. That is how >50% of this site's page views turned out to be errors
 * without anyone noticing.
 *
 * The `page_path` parameter turns the redirect-map work into something
 * measurable: the most-requested missing paths are exactly the URLs worth
 * redirecting first.
 */
export function NotFoundTracker() {
  const pathname = usePathname();

  useEffect(() => {
    window.gtag?.("event", "page_not_found", {
      page_path: pathname,
      page_location: window.location.href,
      page_referrer: document.referrer || undefined,
    });
  }, [pathname]);

  return null;
}
