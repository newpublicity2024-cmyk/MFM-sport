import { NextResponse } from "next/server";
import { getLiveFixturesForLeagues } from "@/lib/api-football/fixtures";
import { getOurLeagueIds } from "@/lib/payload/queries";

export const revalidate = 30;

export async function GET() {
  const leagueIds = await getOurLeagueIds();
  const fixtures = await getLiveFixturesForLeagues(leagueIds);
  return NextResponse.json({ fixtures });
}
