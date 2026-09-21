import { cache } from "react";
import type { ApiFixture } from "./types";
import { fetchApi } from "./client";
import { cachedJson, hasUpstash } from "@/lib/cache";

/**
 * The last `last` meetings between two teams, most recent first.
 *
 * Keyed on the sorted pair so `a-b` and `b-a` share one cache entry, and
 * cached for a day: the answer only changes when these two teams play each
 * other, and the match page that shows it is the one they are about to play.
 */
export const getHeadToHead = cache(
  async (teamA: number, teamB: number, last = 5): Promise<ApiFixture[]> => {
    const [lo, hi] = teamA < teamB ? [teamA, teamB] : [teamB, teamA];
    const params = { h2h: `${lo}-${hi}`, last };
    const fixtures = hasUpstash()
      ? await cachedJson(
          `h2h:${lo}-${hi}:${last}`,
          { ttlSeconds: 86400, staleSeconds: 86400 },
          () => fetchApi<ApiFixture>("/fixtures/headtohead", params, { cache: "no-store" }),
        )
      : await fetchApi<ApiFixture>("/fixtures/headtohead", params, 3600);
    // Upstream orders by date ascending for this endpoint; the page reads
    // newest first, and a re-sort makes the contract independent of that.
    return [...fixtures].sort((a, b) => b.fixture.timestamp - a.fixture.timestamp);
  },
);
