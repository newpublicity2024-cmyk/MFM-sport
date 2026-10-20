import { NextResponse } from "next/server";
import { getLiveFixturesForLeagues } from "@/lib/api-football/fixtures";
import { getOurLeagueIds } from "@/lib/payload/queries";
import { TTL } from "@/lib/api-football/ttl";

export const revalidate = TTL.LIVE_ALL;

export async function GET() {
  const leagueIds = await getOurLeagueIds();
  const fixtures = await getLiveFixturesForLeagues(leagueIds);
  return NextResponse.json({ fixtures });
}
