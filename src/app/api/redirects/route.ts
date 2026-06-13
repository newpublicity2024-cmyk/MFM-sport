import { NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

// The middleware hits this endpoint on every legacy (non-/ar,/fr,/en) path. Most of
// those are random/old URLs that resolve to "no redirect" — so the win is caching the
// MISS as aggressively as the HIT, on the Vercel CDN, keyed by the full ?from= URL.
// Repeat lookups for the same path are then served from cache without invoking the
// function (cuts Function Invocations + Fluid CPU). Editors adding a redirect see it
// within a day; sw-revalidate keeps it serving stale meanwhile.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
} as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");

  if (!from || from.length > 512) {
    return NextResponse.json({ to: null }, { headers: CACHE_HEADERS });
  }

  try {
    const payload = await getPayload({ config: configPromise });
    const result = await payload.find({
      collection: "redirects",
      where: { from: { equals: from } },
      limit: 1,
    });

    if (result.docs[0]) {
      return NextResponse.json(
        {
          to: result.docs[0].to,
          statusCode: result.docs[0].statusCode,
        },
        { headers: CACHE_HEADERS },
      );
    }

    return NextResponse.json({ to: null }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[Redirects] Lookup error:", error);
    // Don't cache transient errors.
    return NextResponse.json({ to: null });
  }
}
