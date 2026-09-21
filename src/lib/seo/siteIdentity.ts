import { SITE_URL } from "./siteUrl";
import { SOCIAL_LINKS } from "@/components/social/socialLinks";

/**
 * How the site names itself to search engines.
 *
 * Google composed the homepage result from leftovers on 21 September 2026:
 * the OLD WordPress title ("MFM Sport - Tout le sport, rien que le sport"),
 * a WordPress shortcode in the snippet, "Mfmsport" as the site name (derived
 * from the domain, since nothing declared one) and the retired English
 * fallback description under a sitelink. None of that is in this codebase;
 * it is what Google falls back to when a site declares nothing. So declare it.
 */
export const SITE_NAME = "MFM Sport";
export const SITE_NAME_AR = "إم إف إم سبور";
export const SITE_SLOGAN_AR = "إم إف إم في قلب الحدث. أخبار الرياضة أولاً بأول.";
export const SITE_LOGO_URL = `${SITE_URL}/images/mfm-sport-logo.png`;

/** The homepage <title>: the Arabic brand and its slogan, nothing else. */
export const HOME_TITLE_AR = `${SITE_NAME_AR} - ${SITE_SLOGAN_AR}`;

/** The site's main sections, as search engines should list them. */
export const NAV_SECTIONS_AR: { name: string; path: string }[] = [
  { name: "الأخبار", path: "/ar/articles" },
  { name: "المسابقات", path: "/ar/competition" },
  { name: "المباريات", path: "/ar/matches" },
  { name: "الفيديو", path: "/ar/videos" },
];

/**
 * JSON-LD for the homepage: WebSite (site name — Google's documented source
 * for the name shown above a result), the publishing organisation (logo,
 * slogan, social profiles) and the main navigation as an ItemList.
 */
export function homeJsonLd() {
  const organisationId = `${SITE_URL}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME_AR,
        alternateName: [SITE_NAME, "Mfmsport"],
        inLanguage: "ar",
        publisher: { "@id": organisationId },
      },
      {
        "@type": "NewsMediaOrganization",
        "@id": organisationId,
        name: SITE_NAME_AR,
        alternateName: SITE_NAME,
        url: SITE_URL,
        slogan: SITE_SLOGAN_AR,
        logo: {
          "@type": "ImageObject",
          url: SITE_LOGO_URL,
          width: 887,
          height: 887,
        },
        sameAs: Object.values(SOCIAL_LINKS).map((s) => s.href),
      },
      {
        "@type": "ItemList",
        "@id": `${SITE_URL}/#navigation`,
        name: "الأقسام الرئيسية",
        itemListElement: NAV_SECTIONS_AR.map((s, i) => ({
          "@type": "SiteNavigationElement",
          position: i + 1,
          name: s.name,
          url: `${SITE_URL}${s.path}`,
        })),
      },
    ],
  };
}
