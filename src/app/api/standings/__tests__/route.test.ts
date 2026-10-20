import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-football/standings", () => ({
  getStandings: vi.fn().mockResolvedValue([{ rank: 1 }]),
}));

import { GET } from "@/app/api/standings/route";
import { getStandings } from "@/lib/api-football/standings";
import { TTL } from "@/lib/api-football/ttl";

describe("GET /api/standings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns standings for valid params", async () => {
    const res = await GET(new Request("http://x/api/standings?league=39&season=2025"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ standings: [{ rank: 1 }] });
    expect(getStandings).toHaveBeenCalledWith(39, 2025, {
      maxAgeSeconds: TTL.STANDINGS_LIVE,
    });
  });

  // This route is what `LiveStandings` polls while a match in the league is in
  // play, so it must ask for a tighter age than the competition page's own
  // render does. They share one cache entry; only the tolerance differs. If
  // these two ever became equal, a live table would go as stale as the page's.
  it("demands a tighter age than the competition page accepts", async () => {
    await GET(new Request("http://x/api/standings?league=39&season=2025"));
    const [, , freshness] = vi.mocked(getStandings).mock.calls[0]!;
    expect(freshness?.maxAgeSeconds).toBe(TTL.STANDINGS_LIVE);
    expect(TTL.STANDINGS_LIVE).toBeLessThan(TTL.STANDINGS);
  });

  it("lets the CDN collapse repeat polls", async () => {
    const res = await GET(new Request("http://x/api/standings?league=39&season=2025"));
    // The handler reads searchParams, so Next treats it as dynamic and will not
    // cache the response itself — the header is the only thing that stops every
    // viewer's poll becoming its own function invocation.
    expect(res.headers.get("cache-control")).toContain(
      `s-maxage=${TTL.STANDINGS_LIVE}`,
    );
  });

  it("returns 400 when params are missing or non-numeric", async () => {
    const res = await GET(new Request("http://x/api/standings?league=abc"));
    expect(res.status).toBe(400);
    expect(getStandings).not.toHaveBeenCalled();
  });
});
