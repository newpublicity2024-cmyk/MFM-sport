// src/lib/api-football/ttl.ts
//
// One table of maximum acceptable ages for API-Football reads, in seconds.
//
// WHY THIS FILE EXISTS
//
// Every getter used to carry the number twice: once as the Redis `ttlSeconds`
// and once as the `revalidate` handed to `fetch`. The two disagreed by 15× to
// 60× — standings were 3600 on one line and 60 on the next, team form 900 and
// 60, head-to-head 86400 and 3600 — and because the Redis branch was dead
// (`hasUpstash()` never matched Vercel's `KV_*` names) the shorter number was
// the only one that ever ran. Declaring each value once makes that class of
// drift unrepresentable.
//
// A value here is the READER's tolerance, not a writer-side expiry: see
// `cachedJson` in `@/lib/cache`. Two callers may share one key and ask for
// different freshness, and the stricter one simply refreshes it sooner.
//
// Raising any of these trades freshness for upstream quota. Before you do,
// check whether the surface that reads it refreshes client-side — several do
// and several deliberately do not (noted below).

export const TTL = {
  /**
   * One fixture, for the match page and `/api/fixtures/[id]`.
   *
   * Short because `LiveScoreboard` renders from the server value first and the
   * match page is the surface a reader watches during a game. The client poll
   * on `/api/fixtures/[id]` reads the same key, so lengthening this would make
   * that poll return stale scores.
   */
  FIXTURE_BY_ID: 30,

  /** All in-play fixtures. Feeds every client live poll; must stay short. */
  LIVE_ALL: 30,

  /**
   * One day's fixtures, for today.
   *
   * Stays at a minute because `/ar/matches` renders `MatchList` straight from
   * this read with **no client-side live merge** — the homepage panels do merge
   * (`useLiveFixtures`), but the standalone matches page does not, so a longer
   * value would show stale scores there. Do not raise without giving that page
   * a live merge first.
   */
  DATE_TODAY: 60,

  /** One day's fixtures, for any other date. Schedules and results barely move. */
  DATE_OTHER: 1800,

  /** A league's season fixture list — the homepage hero panel's source. */
  LEAGUE_SEASON: 900,

  /** A team's fixtures, for club pages and match-page form. */
  TEAM_FIXTURES: 900,

  /**
   * A competition's table, as the competition page reads it.
   *
   * The page's `LiveStandings` island re-reads `/api/standings` while a match
   * in that league is in play, and that route asks for `STANDINGS_LIVE`
   * instead — same cache key, stricter tolerance.
   */
  STANDINGS: 3600,

  /** The same table as demanded by the polled `/api/standings` route. */
  STANDINGS_LIVE: 60,

  /** Two teams' past meetings. Changes only when they next play each other. */
  HEAD_TO_HEAD: 86400,

  /** Which season a league is currently in. API-Football flips this once a year. */
  CURRENT_SEASON: 21600,
} as const;

/**
 * Stale-while-revalidate windows, in seconds, for the keys that have one.
 *
 * Within `ttl + stale` a reader is served the old value and a single refresh is
 * kicked off behind it, so a TTL expiry under load costs one upstream call
 * rather than a stampede.
 */
export const STALE = {
  DATE_TODAY: 120,
  DATE_OTHER: 3600,
  LEAGUE_SEASON: 1800,
  TEAM_FIXTURES: 1800,
  STANDINGS: 3600,
  HEAD_TO_HEAD: 86400,
  CURRENT_SEASON: 21600,
} as const;
