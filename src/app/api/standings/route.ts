import { NextResponse } from "next/server";
import { getStandings } from "@/lib/api-football/standings";

export const revalidate = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const league = Number(searchParams.get("league"));
  const season = Number(searchParams.get("season"));
  if (!Number.isFinite(league) || !Number.isFinite(season) || league <= 0 || season <= 0) {
    return NextResponse.json({ error: "league and season must be positive numbers" }, { status: 400 });
  }
  const standings = await getStandings(league, season);
  return NextResponse.json({ standings });
}
