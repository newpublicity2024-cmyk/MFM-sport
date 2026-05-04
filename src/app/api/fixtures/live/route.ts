import { NextResponse } from "next/server";
import { getLiveFixtures } from "@/lib/api-football/fixtures";

export const revalidate = 30;

export async function GET() {
  const fixtures = await getLiveFixtures();
  return NextResponse.json({ fixtures });
}
