import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js) loader.
 *
 * Reads the GA4 *Measurement ID* (format "G-XXXXXXXXXX") from
 * NEXT_PUBLIC_GA_MEASUREMENT_ID. The numeric GA "Property ID" is NOT used here —
 * grab the Measurement ID from GA Admin → Data streams → your web stream.
 *
 * Renders nothing when the env var is unset, so local/dev builds stay clean.
 */
export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!measurementId) return null;

  return (
    <>
      <Script
        id="ga-gtag-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
