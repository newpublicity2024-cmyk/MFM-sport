import { NextResponse } from "next/server";
import { getStandings } from "@/lib/api-football/standings";
import { TTL } from "@/lib/api-football/ttl";

export const revalidate = TTL.STANDINGS_LIVE;

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
