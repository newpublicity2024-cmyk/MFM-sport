import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Resend] No RESEND_API_KEY configured — emails will not be sent");
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendConfirmationEmail(
  email: string,
  token: string,
  locale: string,
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${token}`;

  const subjects: Record<string, string> = {
    ar: "تأكيد اشتراكك في MFM Sport",
    fr: "Confirmez votre inscription a MFM Sport",
    en: "Confirm your MFM Sport subscription",
  };

  const bodies: Record<string, string> = {
    ar: `<div dir="rtl"><h2>مرحبا!</h2><p>انقر على الرابط التالي لتأكيد اشتراكك:</p><a href="${confirmUrl}">${confirmUrl}</a></div>`,
    fr: `<h2>Bonjour !</h2><p>Cliquez sur le lien suivant pour confirmer votre inscription :</p><a href="${confirmUrl}">${confirmUrl}</a>`,
    en: `<h2>Hello!</h2><p>Click the following link to confirm your subscription:</p><a href="${confirmUrl}">${confirmUrl}</a>`,
  };

  try {
    await resend.emails.send({
      from: "MFM Sport <noreply@mfmsport.ma>",
      to: email,
      subject: subjects[locale] || subjects.en,
      html: bodies[locale] || bodies.en,
    });
    return true;
  } catch (error) {
    console.error("[Resend] Failed to send confirmation email:", error);
    return false;
  }
}
