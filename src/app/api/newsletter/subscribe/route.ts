import { NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import crypto from "crypto";
import { sendConfirmationEmail } from "@/lib/resend";
import { checkRateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const { success } = await checkRateLimit(`newsletter:${ip}`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { email, locale = "ar" } = await request.json();

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const payload = await getPayload({ config: configPromise });

    const existing = await payload.find({
      collection: "subscribers",
      where: { email: { equals: email.toLowerCase() } },
      limit: 1,
    });

    if (existing.docs[0]) {
      const sub = existing.docs[0];
      if (sub.status === "confirmed") {
        return NextResponse.json({ message: "Already subscribed" }, { status: 200 });
      }
      if (sub.status === "pending") {
        return NextResponse.json({ message: "Confirmation email already sent" }, { status: 200 });
      }
    }

    const confirmToken = crypto.randomBytes(32).toString("hex");

    if (existing.docs[0]) {
      await payload.update({
        collection: "subscribers",
        id: existing.docs[0].id,
        data: { status: "pending", confirmToken, locale, confirmedAt: null as any },
      });
    } else {
      await payload.create({
        collection: "subscribers",
        data: { email: email.toLowerCase(), locale, status: "pending", confirmToken },
      });
    }

    await sendConfirmationEmail(email.toLowerCase(), confirmToken, locale);

    return NextResponse.json({ message: "Confirmation email sent" }, { status: 201 });
  } catch (error) {
    console.error("[Newsletter] Subscribe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
