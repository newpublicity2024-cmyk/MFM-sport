# MFM Sport — Plan 4: Engagement Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add newsletter signup with Resend email integration, a video articles hub page, and CMS-managed static pages (about, contact, legal, privacy).

**Architecture:** Subscribers collection stores newsletter signups with double opt-in flow via confirmation tokens. API routes handle subscribe/confirm/unsubscribe. Resend sends confirmation emails (graceful fallback when key is missing). A Pages collection stores editable static page content. Videos page filters articles by `isVideo` field. Newsletter form is a client component reused in homepage strip and footer.

**Tech Stack:** Payload collections, Resend email API, Next.js route handlers, client-side form with fetch, existing ArticleGrid for videos, Lexical RichText for static pages

---

## Depends On

Plans 1-3 complete. Existing:
- Payload with 8 collections (Users, Media, Categories, Tags, Authors, Articles, Competitions, Clubs)
- Articles have `isVideo` checkbox + `videoUrl` field
- ArticleCard already shows video play indicator
- i18n `newsletter` namespace exists (title, subtitle, placeholder, subscribe, success)
- Footer has links to /about, /contact, /legal, /privacy (not yet created)
- Query helpers in `src/lib/payload/queries.ts`

---

## File Structure

```
src/
  collections/
    Subscribers.ts                           # Task 1
    Pages.ts                                 # Task 1
  lib/
    resend.ts                                # Task 2
  app/
    api/
      newsletter/
        subscribe/route.ts                   # Task 2
        confirm/route.ts                     # Task 2
        unsubscribe/route.ts                 # Task 2
    (frontend)/
      [locale]/
        newsletter/
          confirm/page.tsx                   # Task 4
        unsubscribe/page.tsx                 # Task 4
        videos/page.tsx                      # Task 6
        about/page.tsx                       # Task 7
        contact/page.tsx                     # Task 7
        legal/page.tsx                       # Task 7
        privacy/page.tsx                     # Task 7
  components/
    newsletter/
      NewsletterForm.tsx                     # Task 3
      NewsletterStrip.tsx                    # Task 3
messages/
  ar.json, fr.json, en.json                 # Task 5
src/payload.config.ts                        # Task 1
src/lib/payload/queries.ts                   # Task 6
.env.example                                 # Task 2
```

---

## Task 1: Subscribers + Pages Collections

**Files:**
- Create: `src/collections/Subscribers.ts`
- Create: `src/collections/Pages.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create Subscribers collection**

Create `src/collections/Subscribers.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Subscribers: CollectionConfig = {
  slug: "subscribers",
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "status", "locale", "createdAt"],
  },
  fields: [
    {
      name: "email",
      type: "email",
      required: true,
      unique: true,
    },
    {
      name: "locale",
      type: "select",
      required: true,
      defaultValue: "ar",
      options: [
        { label: "العربية", value: "ar" },
        { label: "Français", value: "fr" },
        { label: "English", value: "en" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Unsubscribed", value: "unsubscribed" },
      ],
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "confirmToken",
      type: "text",
      admin: {
        readOnly: true,
        condition: () => false,
      },
    },
    {
      name: "confirmedAt",
      type: "date",
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },
  ],
};
```

- [ ] **Step 2: Create Pages collection**

Create `src/collections/Pages.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug"],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "URL identifier: about, contact, legal, privacy",
      },
    },
    {
      name: "body",
      type: "richText",
      required: true,
      localized: true,
    },
  ],
};
```

- [ ] **Step 3: Register both in payload.config.ts**

Add imports and update collections array:

```ts
import { Subscribers } from "./collections/Subscribers";
import { Pages } from "./collections/Pages";

collections: [Users, Media, Categories, Tags, Authors, Articles, Competitions, Clubs, Subscribers, Pages],
```

- [ ] **Step 4: Commit**

```bash
git add src/collections/Subscribers.ts src/collections/Pages.ts src/payload.config.ts
git commit -m "feat: add Subscribers and Pages collections"
```

---

## Task 2: Newsletter API Routes + Resend

**Files:**
- Create: `src/lib/resend.ts`
- Create: `src/app/api/newsletter/subscribe/route.ts`
- Create: `src/app/api/newsletter/confirm/route.ts`
- Create: `src/app/api/newsletter/unsubscribe/route.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install Resend**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport"
pnpm add resend
```

- [ ] **Step 2: Create Resend helper**

Create `src/lib/resend.ts`:

```ts
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
```

- [ ] **Step 3: Create subscribe route**

Create `src/app/api/newsletter/subscribe/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import crypto from "crypto";
import { sendConfirmationEmail } from "@/lib/resend";

export async function POST(request: Request) {
  try {
    const { email, locale = "ar" } = await request.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const payload = await getPayload({ config: configPromise });

    // Check if already subscribed
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
      // If unsubscribed, allow re-subscribe
    }

    const confirmToken = crypto.randomBytes(32).toString("hex");

    if (existing.docs[0]) {
      // Re-subscribe: update existing
      await payload.update({
        collection: "subscribers",
        id: existing.docs[0].id,
        data: {
          status: "pending",
          confirmToken,
          locale,
          confirmedAt: null as any,
        },
      });
    } else {
      // New subscriber
      await payload.create({
        collection: "subscribers",
        data: {
          email: email.toLowerCase(),
          locale,
          status: "pending",
          confirmToken,
        },
      });
    }

    await sendConfirmationEmail(email.toLowerCase(), confirmToken, locale);

    return NextResponse.json({ message: "Confirmation email sent" }, { status: 201 });
  } catch (error) {
    console.error("[Newsletter] Subscribe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create confirm route**

Create `src/app/api/newsletter/confirm/route.ts`:

```ts
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
      data: {
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
        confirmToken: "",
      },
    });

    const locale = subscriber.locale || "ar";
    return NextResponse.redirect(new URL(`/${locale}/newsletter/confirm`, request.url));
  } catch (error) {
    console.error("[Newsletter] Confirm error:", error);
    return NextResponse.redirect(new URL("/ar/", request.url));
  }
}
```

- [ ] **Step 5: Create unsubscribe route**

Create `src/app/api/newsletter/unsubscribe/route.ts`:

```ts
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
```

- [ ] **Step 6: Update .env.example**

Add:
```env
# Newsletter (Resend)
RESEND_API_KEY=
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/resend.ts src/app/api/newsletter/ .env.example package.json pnpm-lock.yaml
git commit -m "feat: add newsletter API routes with Resend email integration"
```

---

## Task 3: Newsletter Components + Homepage/Footer Integration

**Files:**
- Create: `src/components/newsletter/NewsletterForm.tsx`
- Create: `src/components/newsletter/NewsletterStrip.tsx`
- Modify: `src/app/(frontend)/[locale]/page.tsx` (add strip to homepage)
- Modify: `src/components/layout/Footer.tsx` (add form to footer)

- [ ] **Step 1: Create NewsletterForm**

Create `src/components/newsletter/NewsletterForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  locale: string;
};

export function NewsletterForm({ locale }: Props) {
  const t = useTranslations("newsletter");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="text-sm text-win font-medium">{t("success")}</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
      <Input
        type="email"
        name="email"
        required
        placeholder={t("placeholder")}
        className="bg-background/50"
        disabled={status === "loading"}
      />
      <Button
        type="submit"
        disabled={status === "loading"}
        className="shrink-0"
      >
        {status === "loading" ? "..." : t("subscribe")}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create NewsletterStrip**

Create `src/components/newsletter/NewsletterStrip.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { NewsletterForm } from "./NewsletterForm";

type Props = {
  locale: string;
};

export function NewsletterStrip({ locale }: Props) {
  const t = useTranslations("newsletter");

  return (
    <section className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 py-10">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-xl font-bold mb-2">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("subtitle")}</p>
        <NewsletterForm locale={locale} />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add NewsletterStrip to homepage**

Read `src/app/(frontend)/[locale]/page.tsx`. Add import:
```tsx
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";
```

Add the strip after the last `<NewsSection>`, before the closing `</div>`:
```tsx
<div className="mt-10">
  <NewsletterStrip locale={locale} />
</div>
```

- [ ] **Step 4: Add NewsletterForm to footer**

Read `src/components/layout/Footer.tsx`. Add import:
```tsx
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
```

Add a newsletter section in the footer grid. Update the grid to 4 columns on desktop and add a newsletter column:

Add before the copyright section:
```tsx
{/* Newsletter */}
<div>
  <h3 className="text-sm font-medium mb-2">
    {locale === "ar" ? "النشرة الإخبارية" : locale === "fr" ? "Newsletter" : "Newsletter"}
  </h3>
  <NewsletterForm locale={locale} />
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/newsletter/ src/app/\(frontend\)/\[locale\]/page.tsx src/components/layout/Footer.tsx
git commit -m "feat: add newsletter signup form, homepage strip, and footer integration"
```

---

## Task 4: Newsletter Confirmation + Unsubscribe Pages

**Files:**
- Create: `src/app/(frontend)/[locale]/newsletter/confirm/page.tsx`
- Create: `src/app/(frontend)/[locale]/unsubscribe/page.tsx`

- [ ] **Step 1: Create confirmation page**

Create `src/app/(frontend)/[locale]/newsletter/confirm/page.tsx`:

```tsx
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewsletterConfirmPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const messages: Record<string, { title: string; message: string }> = {
    ar: {
      title: "تم تأكيد اشتراكك!",
      message: "شكرا لك! ستتلقى آخر أخبار كرة القدم المغربية مباشرة في بريدك الإلكتروني.",
    },
    fr: {
      title: "Inscription confirmee !",
      message: "Merci ! Vous recevrez les dernieres actualites du football marocain directement dans votre boite mail.",
    },
    en: {
      title: "Subscription confirmed!",
      message: "Thank you! You'll receive the latest Moroccan football news directly in your inbox.",
    },
  };

  const { title, message } = messages[locale] || messages.en;

  return (
    <div className="container mx-auto px-4 py-16 text-center max-w-lg">
      <div className="text-4xl mb-4">✓</div>
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create unsubscribe page**

Create `src/app/(frontend)/[locale]/unsubscribe/page.tsx`:

```tsx
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function UnsubscribePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const messages: Record<string, { title: string; message: string }> = {
    ar: {
      title: "تم إلغاء اشتراكك",
      message: "تم إلغاء اشتراكك بنجاح. لن تتلقى المزيد من رسائل البريد الإلكتروني.",
    },
    fr: {
      title: "Desinscription effectuee",
      message: "Vous avez ete desinscrit avec succes. Vous ne recevrez plus d'emails.",
    },
    en: {
      title: "Unsubscribed",
      message: "You have been successfully unsubscribed. You will no longer receive emails.",
    },
  };

  const { title, message } = messages[locale] || messages.en;

  return (
    <div className="container mx-auto px-4 py-16 text-center max-w-lg">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(frontend)/[locale]/newsletter/" "src/app/(frontend)/[locale]/unsubscribe/"
git commit -m "feat: add newsletter confirmation and unsubscribe pages"
```

---

## Task 5: i18n Messages (Videos + Static Pages)

**Files:**
- Modify: `messages/ar.json`, `messages/fr.json`, `messages/en.json`

- [ ] **Step 1: Add video and static page messages to all 3 files**

Add these sections (keep all existing keys):

**Arabic:**
```json
{
  "videos": {
    "title": "فيديو",
    "noVideos": "لا توجد مقاطع فيديو"
  },
  "pages": {
    "about": "من نحن",
    "contact": "اتصل بنا",
    "legal": "إشعار قانوني",
    "privacy": "سياسة الخصوصية",
    "noContent": "المحتوى قيد الإعداد"
  }
}
```

**French:**
```json
{
  "videos": {
    "title": "Videos",
    "noVideos": "Aucune video"
  },
  "pages": {
    "about": "A propos",
    "contact": "Contact",
    "legal": "Mentions legales",
    "privacy": "Politique de confidentialite",
    "noContent": "Contenu en preparation"
  }
}
```

**English:**
```json
{
  "videos": {
    "title": "Videos",
    "noVideos": "No videos found"
  },
  "pages": {
    "about": "About",
    "contact": "Contact",
    "legal": "Legal Notice",
    "privacy": "Privacy Policy",
    "noContent": "Content coming soon"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add messages/
git commit -m "feat: add videos and static pages i18n messages"
```

---

## Task 6: Videos Page

**Files:**
- Modify: `src/lib/payload/queries.ts` (add getVideoArticles)
- Create: `src/app/(frontend)/[locale]/videos/page.tsx`

- [ ] **Step 1: Add video articles query helper**

Add to `src/lib/payload/queries.ts` (keep all existing functions):

```ts
export async function getVideoArticles(
  locale: string,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      isVideo: { equals: true },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}
```

- [ ] **Step 2: Create videos page**

Create `src/app/(frontend)/[locale]/videos/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getVideoArticles } from "@/lib/payload/queries";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { Pagination } from "@/components/shared/Pagination";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "videos" });
  return { title: `${t("title")} | MFM Sport` };
}

export default async function VideosPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "videos" });
  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const result = await getVideoArticles(locale, currentPage);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {result.docs.length > 0 ? (
        <>
          <ArticleGrid articles={result.docs} locale={locale} columns={3} />
          <Pagination
            currentPage={result.page!}
            totalPages={result.totalPages}
            basePath={`/${locale}/videos`}
          />
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">{t("noVideos")}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/payload/queries.ts "src/app/(frontend)/[locale]/videos/"
git commit -m "feat: add videos page filtering video articles"
```

---

## Task 7: Static Pages (About, Contact, Legal, Privacy)

**Files:**
- Modify: `src/lib/payload/queries.ts` (add getPageBySlug)
- Create: `src/app/(frontend)/[locale]/about/page.tsx`
- Create: `src/app/(frontend)/[locale]/contact/page.tsx`
- Create: `src/app/(frontend)/[locale]/legal/page.tsx`
- Create: `src/app/(frontend)/[locale]/privacy/page.tsx`

- [ ] **Step 1: Add page query helper**

Add to `src/lib/payload/queries.ts`:

```ts
export async function getPageBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "pages",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
  });
  return result.docs[0] || null;
}
```

- [ ] **Step 2: Create about page**

Create `src/app/(frontend)/[locale]/about/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getPageBySlug } from "@/lib/payload/queries";
import { ArticleBody } from "@/components/articles/ArticleBody";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: `${t("about")} | MFM Sport` };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });
  const page = await getPageBySlug("about", locale);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{page?.title || t("about")}</h1>
      {page?.body ? (
        <ArticleBody content={page.body} />
      ) : (
        <p className="text-muted-foreground">{t("noContent")}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create contact page**

Create `src/app/(frontend)/[locale]/contact/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getPageBySlug } from "@/lib/payload/queries";
import { ArticleBody } from "@/components/articles/ArticleBody";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: `${t("contact")} | MFM Sport` };
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });
  const page = await getPageBySlug("contact", locale);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{page?.title || t("contact")}</h1>
      {page?.body ? (
        <ArticleBody content={page.body} />
      ) : (
        <p className="text-muted-foreground">{t("noContent")}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create legal page**

Create `src/app/(frontend)/[locale]/legal/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getPageBySlug } from "@/lib/payload/queries";
import { ArticleBody } from "@/components/articles/ArticleBody";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: `${t("legal")} | MFM Sport` };
}

export default async function LegalPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });
  const page = await getPageBySlug("legal", locale);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{page?.title || t("legal")}</h1>
      {page?.body ? (
        <ArticleBody content={page.body} />
      ) : (
        <p className="text-muted-foreground">{t("noContent")}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create privacy page**

Create `src/app/(frontend)/[locale]/privacy/page.tsx`:

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getPageBySlug } from "@/lib/payload/queries";
import { ArticleBody } from "@/components/articles/ArticleBody";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: `${t("privacy")} | MFM Sport` };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });
  const page = await getPageBySlug("privacy", locale);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{page?.title || t("privacy")}</h1>
      {page?.body ? (
        <ArticleBody content={page.body} />
      ) : (
        <p className="text-muted-foreground">{t("noContent")}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/payload/queries.ts "src/app/(frontend)/[locale]/about/" "src/app/(frontend)/[locale]/contact/" "src/app/(frontend)/[locale]/legal/" "src/app/(frontend)/[locale]/privacy/"
git commit -m "feat: add CMS-managed static pages (about, contact, legal, privacy)"
```

---

## Self-Review

**Spec coverage (from PROJECT_MEMORY.md §16, §18):**
- Subscribers collection: Task 1 (email, locale, status, confirmToken, confirmedAt)
- Pages collection: Task 1 (title, slug, body — CMS-editable)
- Newsletter subscribe API: Task 2 (POST /api/newsletter/subscribe)
- Newsletter confirm API: Task 2 (GET /api/newsletter/confirm?token=)
- Newsletter unsubscribe API: Task 2 (GET /api/newsletter/unsubscribe?email=)
- Resend integration: Task 2 (graceful fallback when key missing)
- Newsletter form component: Task 3 (client-side form with loading/success/error states)
- Newsletter strip on homepage: Task 3 (red gradient full-width)
- Newsletter in footer: Task 3
- Confirmation page: Task 4 (/[locale]/newsletter/confirm)
- Unsubscribe page: Task 4 (/[locale]/unsubscribe)
- Videos page: Task 6 (/[locale]/videos — filters articles by isVideo)
- Video articles query: Task 6 (getVideoArticles)
- About page: Task 7 (/[locale]/about)
- Contact page: Task 7 (/[locale]/contact)
- Legal page: Task 7 (/[locale]/legal)
- Privacy page: Task 7 (/[locale]/privacy)
- i18n messages: Task 5 (videos + pages namespaces)

**No gaps found.**

**Type consistency:** All pages use `params: Promise<{ locale: string }>` pattern. Newsletter form uses `/api/newsletter/subscribe` endpoint consistently. Static pages all use `getPageBySlug` + `ArticleBody` pattern. Query helpers follow existing `getPayloadClient()` pattern.

---

*Plan written 2026-04-20. Ready for execution.*
