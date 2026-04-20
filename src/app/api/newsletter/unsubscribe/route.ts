import { NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.redirect(new URL("/ar/", request.url));
  }

  try {
    const payload = await getPayload({ config: configPromise });

    const result = await payload.find({
      collection: "subscribers",
      where: { email: { equals: email.toLowerCase() } },
      limit: 1,
    });

    const subscriber = result.docs[0];
    if (subscriber) {
      await payload.update({
        collection: "subscribers",
        id: subscriber.id,
        data: { status: "unsubscribed" },
      });
    }

    const locale = subscriber?.locale || "ar";
    return NextResponse.redirect(new URL(`/${locale}/unsubscribe`, request.url));
  } catch (error) {
    console.error("[Newsletter] Unsubscribe error:", error);
    return NextResponse.redirect(new URL("/ar/", request.url));
  }
}
