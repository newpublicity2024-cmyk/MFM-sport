import { NextResponse } from "next/server";
import { getFixtureById } from "@/lib/api-football/fixtures";

export const revalidate = 30;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const fixtureId = Number(id);
  if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ fixture });
}
