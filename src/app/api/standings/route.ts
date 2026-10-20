import { NextResponse } from "next/server";
import { getStandings } from "@/lib/api-football/standings";
import { TTL } from "@/lib/api-football/ttl";

// NOTE: Next requires a route segment config export to be a statically
// analyzable literal — `export const revalidate = TTL.X` fails the build with
// "Invalid segment configuration export detected" even though it typechecks
// and every test passes. The number is therefore duplicated from
// lib/api-football/ttl.ts, and `src/app/api/__tests__/segmentConfig.test.ts`
// asserts the two never drift.
export const revalidate = 60; // TTL.STANDINGS_LIVE

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league = Number(searchParams.get("league"));
  const season = Number(searchParams.get("season"));
  if (!Number.isFinite(league) || !Number.isFinite(season) || league <= 0 || season <= 0) {
    return NextResponse.json({ error: "league and season must be positive numbers" }, { status: 400 });
  }
  // `LiveStandings` polls this while a match in the league is in play, so it
  // asks for a tighter age than the competition page does. Same cache entry,
  // stricter tolerance — see lib/api-football/ttl.
  const standings = await getStandings(league, season, {
    maxAgeSeconds: TTL.STANDINGS_LIVE,
  });
  return NextResponse.json(
    { standings },
    {
      // This handler reads searchParams, so it is dynamic and Next will not
      // cache the response itself. Saying so explicitly lets the CDN collapse
      // repeat polls instead of invoking the function per viewer.
      headers: {
        "cache-control": `public, s-maxage=${TTL.STANDINGS_LIVE}, stale-while-revalidate=${TTL.STANDINGS_LIVE * 2}`,
      },
    },
  );
}
