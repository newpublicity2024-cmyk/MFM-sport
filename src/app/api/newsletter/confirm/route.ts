import { NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/ar/", request.url));
  }

  try {
    const payload = await getPayload({ config: configPromise });

    const result = await payload.find({
      collection: "subscribers",
      where: { confirmToken: { equals: token } },
      limit: 1,
    });

    const subscriber = result.docs[0];
    if (!subscriber) {
      return NextResponse.redirect(new URL("/ar/", request.url));
    }

    await payload.update({
      collection: "subscribers",
      id: subscriber.id,
      data: { status: "confirmed", confirmedAt: new Date().toISOString(), confirmToken: "" },
    });

    const locale = subscriber.locale || "ar";
    return NextResponse.redirect(new URL(`/${locale}/newsletter/confirm`, request.url));
  } catch (error) {
    console.error("[Newsletter] Confirm error:", error);
    return NextResponse.redirect(new URL("/ar/", request.url));
  }
}
