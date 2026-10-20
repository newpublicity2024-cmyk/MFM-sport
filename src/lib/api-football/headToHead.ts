import { cache } from "react";
import type { ApiFixture } from "./types";
import { fetchApi } from "./client";
import { cachedJson } from "@/lib/cache";
import { TTL, STALE } from "./ttl";

/**
 * The last `last` meetings between two teams, most recent first.
 *
 * Keyed on the sorted pair so `a-b` and `b-a` share one cache entry, and
 * cached for a day: the answer only changes when these two teams play each
 * other, and the match page that shows it is the one they are about to play.
 * (That day was previously only honoured on the dead Redis tier — the fetch
 * underneath asked for an hour, 24× more often. Both now read `./ttl`.)
 */
export const getHeadToHead = cache(
  async (teamA: number, teamB: number, last = 5): Promise<ApiFixture[]> => {
    const [lo, hi] = teamA < teamB ? [teamA, teamB] : [teamB, teamA];
    const params = { h2h: `${lo}-${hi}`, last };
    const fixtures = await cachedJson(
      `h2h:${lo}-${hi}:${last}`,
      { ttlSeconds: TTL.HEAD_TO_HEAD, staleSeconds: STALE.HEAD_TO_HEAD },
      () =>
        fetchApi<ApiFixture>("/fixtures/headtohead", params, {
          revalidate: TTL.HEAD_TO_HEAD,
        }),
    );
    // Upstream orders by date ascending for this endpoint; the page reads
    // newest first, and a re-sort makes the contract independent of that.
    return [...fixtures].sort((a, b) => b.fixture.timestamp - a.fixture.timestamp);
  },
);
