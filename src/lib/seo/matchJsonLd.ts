import type { ApiFixture } from "@/lib/api-football/types";
import { localizeLeague, localizeTeam } from "@/lib/api-football/localize";
import { describeStatus } from "@/lib/api-football/status";
import { SITE_URL } from "@/lib/seo/siteUrl";

/**
 * Structured data for one match page: a `SportsEvent` (teams, kick-off instant,
 * venue, schema.org event status) and the breadcrumb trail. It tells Google
 * what the entities on the page are; it is not a rich-result bid, and nothing
 * here is invented — every optional field is omitted when upstream has no value.
 * The competition is named in `description` rather than as a nested
 * `superEvent`: a nested Event with no date or place of its own only draws
 * validator warnings.
 */
export function matchJsonLd(
  fixture: ApiFixture,
  locale: string,
  labels: { home: string; matches: string },
) {
  const home = localizeTeam(fixture.teams.home.id, fixture.teams.home.name, locale);
  const away = localizeTeam(fixture.teams.away.id, fixture.teams.away.name, locale);
  const league = localizeLeague(fixture.league.id, fixture.league.name, locale);
  const url = `${SITE_URL}/${locale}/matches/${fixture.fixture.id}`;
  const venue = fixture.fixture.venue;

  const event: Record<string, unknown> = {
    "@type": "SportsEvent",
    "@id": `${url}#event`,
    name: `${home} ضد ${away}`,
    description: `${home} ضد ${away} في ${league}`,
    url,
    startDate: fixture.fixture.date,
    eventStatus: describeStatus(fixture.fixture.status.short).eventStatus,
    sport: "Football",
    homeTeam: { "@type": "SportsTeam", name: home, logo: fixture.teams.home.logo },
    awayTeam: { "@type": "SportsTeam", name: away, logo: fixture.teams.away.logo },
  };
  if (venue?.name) {
    event.location = {
      "@type": "Place",
      name: venue.name,
      ...(venue.city ? { address: { "@type": "PostalAddress", addressLocality: venue.city } } : {}),
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      event,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: labels.home, item: `${SITE_URL}/${locale}` },
          { "@type": "ListItem", position: 2, name: labels.matches, item: `${SITE_URL}/${locale}/matches` },
          { "@type": "ListItem", position: 3, name: `${home} ضد ${away}`, item: url },
        ],
      },
    ],
  };
}
