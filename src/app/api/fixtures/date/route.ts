import { NextResponse } from "next/server";
import { getFixturesByDateForLeagues } from "@/lib/api-football/fixtures";
import { getOurLeagueIds } from "@/lib/payload/queries";

/**
 * One day's fixtures across the leagues the site lists — what the homepage
 * matches section loads when a visitor picks another day in its calendar.
 * Cached per URL for a minute; the upstream read behind it is cached longer
 * for days other than today (see lib/api-football/fixtures.getFixturesByDate).
 */
export const revalidate = 60;

/** Mirrors the upstream tolerance for a day's fixtures. */
const DATE_ROUTE_SMAXAGE = 60;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(s: string | null): s is string {
  if (!s || !ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!isValidIsoDate(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const leagueIds = await getOurLeagueIds();
  const fixtures = await getFixturesByDateForLeagues(date, leagueIds);
  // Reading searchParams makes this handler dynamic, so the `revalidate` above
  // never applied to the response and every request reached the function
  // (verified on production: x-vercel-cache MISS on every call). An explicit
  // header lets the CDN serve repeats for the same day.
  return NextResponse.json(
    { fixtures },
    {
      headers: {
        "cache-control": `public, s-maxage=${DATE_ROUTE_SMAXAGE}, stale-while-revalidate=${DATE_ROUTE_SMAXAGE * 2}`,
      },
    },
  );
}
