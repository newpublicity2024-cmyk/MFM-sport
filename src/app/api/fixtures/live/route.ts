import { NextResponse } from "next/server";
import { getLiveFixturesForLeagues } from "@/lib/api-football/fixtures";
import { getOurLeagueIds } from "@/lib/payload/queries";

// NOTE: Next requires a route segment config export to be a statically
// analyzable literal — `export const revalidate = TTL.X` fails the build with
// "Invalid segment configuration export detected" even though it typechecks
// and every test passes. The number is therefore duplicated from
// lib/api-football/ttl.ts, and `src/app/api/__tests__/segmentConfig.test.ts`
// asserts the two never drift.
export const revalidate = 30; // TTL.LIVE_ALL

export async function GET() {
  const leagueIds = await getOurLeagueIds();
  const fixtures = await getLiveFixturesForLeagues(leagueIds);
  return NextResponse.json({ fixtures });
}
