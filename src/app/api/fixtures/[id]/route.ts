import { NextResponse } from "next/server";
import { getFixtureById } from "@/lib/api-football/fixtures";
import { TTL } from "@/lib/api-football/ttl";

// NOTE: Next requires a route segment config export to be a statically
// analyzable literal — `export const revalidate = TTL.X` fails the build with
// "Invalid segment configuration export detected" even though it typechecks
// and every test passes. The number is therefore duplicated from
// lib/api-football/ttl.ts, and `src/app/api/__tests__/segmentConfig.test.ts`
// asserts the two never drift.
export const revalidate = 30; // TTL.FIXTURE_BY_ID

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const fixtureId = Number(id);
  if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Dynamic (the id comes from the path params), so Next does not cache the
  // response. `LiveScoreboard` polls this every 30s per open tab; the header
  // lets the CDN answer those from one function invocation.
  return NextResponse.json(
    { fixture },
    {
      headers: {
        "cache-control": `public, s-maxage=${TTL.FIXTURE_BY_ID}, stale-while-revalidate=${TTL.FIXTURE_BY_ID * 2}`,
      },
    },
  );
}
