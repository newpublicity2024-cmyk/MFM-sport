import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getPayloadClient } from "@/lib/payload/queries";
import { syncVideos } from "@/lib/youtube-sync";

// Scheduled by Vercel Cron (see vercel.json). Vercel invokes this with
// `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set, which also
// blocks public access. Runs the YouTube -> videos sync, then revalidates the
// pages that render videos so new uploads appear immediately.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY not set" }, { status: 500 });
  }

  try {
    const payload = await getPayloadClient();
    const result = await syncVideos(payload, apiKey, { prune: true });

    for (const loc of ["ar", "fr", "en"]) {
      revalidatePath(`/${loc}`);
      revalidatePath(`/${loc}/videos`);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/sync-videos] failed:", error);
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}
