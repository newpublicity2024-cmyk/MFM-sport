import type { CompetitionRef } from "@/lib/api-football/competition";

/**
 * Ordering and selection for Competitions docs.
 *
 * The site used to pin two league ids in code — Botola (200) first, World Cup
 * (1) second, everything else after. That ordering is now the collection's
 * `displayOrder` field, so an editor can promote whichever competition is
 * actually in season without a deploy.
 */

/** Docs missing displayOrder sort after every doc that has one. */
export const DEFAULT_DISPLAY_ORDER = 100;

export type OrderableCompetition = {
  slug: string;
  displayOrder?: number | null;
};

/**
 * Ascending by displayOrder, ties broken by slug so the order is stable across
 * renders (an unstable sort here would reshuffle the carousel between ISR
 * regenerations).
 */
export function byDisplayOrder(a: OrderableCompetition, b: OrderableCompetition): number {
  const ra = a.displayOrder ?? DEFAULT_DISPLAY_ORDER;
  const rb = b.displayOrder ?? DEFAULT_DISPLAY_ORDER;
  if (ra !== rb) return ra - rb;
  return a.slug.localeCompare(b.slug);
}

/** A copy sorted by display order; never mutates the caller's array. */
export function sortByDisplayOrder<T extends OrderableCompetition>(docs: T[]): T[] {
  return docs.slice().sort(byDisplayOrder);
}

/**
 * The site's default competition: whichever sorts first. This is the fallback
 * used wherever an admin has not chosen one explicitly, and it is deliberately
 * data — not a constant — so "the league currently playing" is a CMS edit.
 */
export function pickDefaultCompetition<T extends OrderableCompetition>(docs: T[]): T | null {
  return sortByDisplayOrder(docs)[0] ?? null;
}

/** A usable competition reference: enough to fetch fixtures and title a card. */
export type ResolvedCompetition = CompetitionRef & {
  slug?: string;
  /** Already localized by the locale-aware Payload read. */
  name?: string;
};

/**
 * A Payload relationship value → a ResolvedCompetition, or null when the value
 * is absent or came back as a bare id (depth too shallow to be usable).
 */
export function toCompetitionRef(value: unknown): ResolvedCompetition | null {
  if (!value || typeof value !== "object") return null;
  const c = value as {
    apiFootballId?: unknown;
    season?: unknown;
    slug?: unknown;
    name?: unknown;
  };
  if (typeof c.apiFootballId !== "number") return null;
  if (typeof c.season !== "number") return null;
  return {
    apiFootballId: c.apiFootballId,
    season: c.season,
    slug: typeof c.slug === "string" ? c.slug : undefined,
    name: typeof c.name === "string" ? c.name : undefined,
  };
}

/**
 * The competition a matches surface should feature: the one an editor chose,
 * else the default (lowest displayOrder), else null when the site has no
 * competitions at all. The single place the "chosen, else default" rule lives,
 * shared by the homepage hero panel and the article-page sidebar.
 */
export function resolveFeaturedCompetition<T extends OrderableCompetition>(
  chosen: unknown,
  docs: T[],
): ResolvedCompetition | null {
  return toCompetitionRef(chosen) ?? toCompetitionRef(pickDefaultCompetition(docs));
}

/**
 * Crest URL for a competition: the CMS logo wins, then API-Football's CDN.
 * The World Cup's custom emblem used to be a special case in code; it is now
 * just a `logoUrl` on that competition's doc, so any competition can override
 * the upstream crest the same way.
 */
export function competitionLogoUrl(apiFootballId: number, logoUrl?: string | null): string {
  return logoUrl || `https://media.api-sports.io/football/leagues/${apiFootballId}.png`;
}

/**
 * league id → CMS logo, for components that only ever see upstream fixture data
 * (which carries API-Football's crest, not ours). Only docs with an explicit
 * logoUrl appear, so the map is empty when nothing overrides.
 */
export function buildLogoOverrides(
  docs: { apiFootballId?: number | null; logoUrl?: string | null }[],
): Record<number, string> {
  const out: Record<number, string> = {};
  for (const c of docs) {
    if (typeof c.apiFootballId === "number" && c.logoUrl) out[c.apiFootballId] = c.logoUrl;
  }
  return out;
}

/**
 * league id → display order, so components grouping *upstream* fixtures by
 * league can rank them the way the CMS ranks competitions.
 */
export function buildLeagueOrder(
  docs: { apiFootballId?: number | null; displayOrder?: number | null }[],
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const c of docs) {
    if (typeof c.apiFootballId === "number") {
      out[c.apiFootballId] = c.displayOrder ?? DEFAULT_DISPLAY_ORDER;
    }
  }
  return out;
}
