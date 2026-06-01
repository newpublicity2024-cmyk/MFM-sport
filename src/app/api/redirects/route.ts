import { NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");

  if (!from || from.length > 512) {
    return NextResponse.json({ to: null });
  }

  try {
    const payload = await getPayload({ config: configPromise });
    const result = await payload.find({
      collection: "redirects",
      where: { from: { equals: from } },
      limit: 1,
    });

    if (result.docs[0]) {
      return NextResponse.json({
        to: result.docs[0].to,
        statusCode: result.docs[0].statusCode,
      });
    }

    return NextResponse.json({ to: null });
  } catch (error) {
    console.error("[Redirects] Lookup error:", error);
    return NextResponse.json({ to: null });
  }
}
