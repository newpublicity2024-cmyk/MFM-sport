# Ad Banners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Google AdSense banners (header leaderboard, in-article mid, in-article bottom, between-grid, sticky mobile bottom) with a locale-aware "Advertisement" label wrapper and CLS-safe reserved containers.

**Architecture:** One `<Script>` tag loads the AdSense JS once from the outer `(frontend)/layout.tsx` (gated by `NEXT_PUBLIC_ADSENSE_CLIENT_ID`). A single `<AdSlot>` client component renders each placement, reading slot IDs from a central registry. Above-fold slots call `adsbygoogle.push()` immediately on mount; below-fold slots defer via `IntersectionObserver`. Empty slots collapse via `:has()` CSS on AdSense's `data-ad-status="unfilled"`.

**Tech Stack:** Next.js 16, React 19, Payload 3, next-intl 4, Tailwind 3, Vitest + jsdom + React Testing Library.

**Reference spec:** [docs/superpowers/specs/2026-04-24-ad-banners-design.md](../specs/2026-04-24-ad-banners-design.md)

---

## File Structure

**Create:**
- `src/lib/ads/slots.ts` — slot name → AdSense slot ID registry + client ID constant
- `src/components/ads/AdLabel.tsx` — locale-aware label + border wrapper
- `src/components/ads/AdSlot.tsx` — client component, renders `<ins class="adsbygoogle">`, eager/lazy `push()`
- `src/components/ads/StickyMobileAd.tsx` — fixed-bottom variant with dismiss button + sessionStorage
- `src/components/articles/InArticleAdInjector.tsx` — splits Lexical content root at first paragraph, injects `<AdSlot>` between halves
- `public/ads.txt` — publisher identity file (empty-ish placeholder, filled after AdSense approval)
- `src/components/ads/__tests__/AdLabel.test.tsx`
- `src/components/ads/__tests__/AdSlot.test.tsx`
- `src/components/ads/__tests__/StickyMobileAd.test.tsx`
- `src/components/articles/__tests__/InArticleAdInjector.test.tsx`

**Modify:**
- `src/app/(frontend)/layout.tsx` — add AdSense `<Script>` (outside NextIntlClientProvider, gated by env)
- `src/app/(frontend)/[locale]/layout.tsx` — mount header leaderboard above `<Header>`, mount `<StickyMobileAd>` in tree
- `src/app/(frontend)/[locale]/articles/[slug]/page.tsx` — wrap body with `<InArticleAdInjector>`, add bottom `<AdSlot>` before `<RelatedArticles>`
- `src/components/articles/ArticleGrid.tsx` — add optional `withAds` prop, inject `<AdSlot format="in-grid">` every 8 cards when true
- `src/app/(frontend)/[locale]/articles/page.tsx` — pass `withAds` to grid
- `src/app/(frontend)/[locale]/category/[slug]/page.tsx` — pass `withAds` to grid
- `src/app/(frontend)/[locale]/tag/[slug]/page.tsx` — pass `withAds` to grid
- `messages/ar.json`, `messages/fr.json`, `messages/en.json` — add `ads.label`
- `src/app/(frontend)/[locale]/styles.css` (or existing global css file) — add `:has()` rule to hide unfilled ads
- `.env.example` — document `NEXT_PUBLIC_ADSENSE_CLIENT_ID`

---

## Task 1: Registry, env, ads.txt, translations

**Files:**
- Create: `src/lib/ads/slots.ts`
- Create: `public/ads.txt`
- Modify: `.env.example`
- Modify: `messages/ar.json`, `messages/fr.json`, `messages/en.json`

- [ ] **Step 1: Create the slot registry**

Create `src/lib/ads/slots.ts`:

```typescript
export type SlotFormat = "leaderboard" | "in-article" | "in-grid" | "sticky-mobile";

export type SlotName =
  | "headerLeaderboard"
  | "inArticleMid"
  | "inArticleBottom"
  | "inGrid"
  | "stickyMobile";

// AdSense slot IDs — fill these in from the AdSense dashboard after site approval.
// Each must be a string like "1234567890". Empty string disables the slot.
export const AD_SLOTS: Record<SlotName, string> = {
  headerLeaderboard: "",
  inArticleMid: "",
  inArticleBottom: "",
  inGrid: "",
  stickyMobile: "",
};

export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "";

export function isAdsEnabled(): boolean {
  return Boolean(ADSENSE_CLIENT_ID);
}
```

- [ ] **Step 2: Create ads.txt placeholder**

Create `public/ads.txt` with one line:

```
# Replace pub-XXXXXXXXXXXXXXXX with the publisher ID from AdSense after approval.
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

- [ ] **Step 3: Document env var in .env.example**

Read `.env.example` first. Append this block at the bottom:

```
# Google AdSense
# Leave unset in dev/staging to disable ad loading entirely.
# Fill in after AdSense approves the site.
NEXT_PUBLIC_ADSENSE_CLIENT_ID=
```

- [ ] **Step 4: Add `ads.label` key to all three message files**

In `messages/en.json`, add a new top-level key (place alphabetically, between existing sections):

```json
  "ads": {
    "label": "Advertisement"
  },
```

In `messages/fr.json`:

```json
  "ads": {
    "label": "Publicité"
  },
```

In `messages/ar.json`:

```json
  "ads": {
    "label": "إعلان"
  },
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ads/slots.ts public/ads.txt .env.example messages/ar.json messages/fr.json messages/en.json
git commit -m "feat(ads): add slot registry, ads.txt, env gate, and translations"
```

---

## Task 2: AdLabel component (TDD)

**Files:**
- Create: `src/components/ads/AdLabel.tsx`
- Create: `src/components/ads/__tests__/AdLabel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ads/__tests__/AdLabel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect } from "vitest";
import { AdLabel } from "../AdLabel";

const messages = { ads: { label: "Advertisement" } };

function renderWithIntl(ui: React.ReactElement, locale = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("AdLabel", () => {
  it("renders the label text from translations", () => {
    renderWithIntl(<AdLabel><div>child</div></AdLabel>);
    expect(screen.getByText("Advertisement")).toBeInTheDocument();
  });

  it("renders children inside the wrapper", () => {
    renderWithIntl(<AdLabel><span data-testid="inner">ad here</span></AdLabel>);
    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });

  it("uses aside with aria-label for accessibility", () => {
    renderWithIntl(<AdLabel><div>child</div></AdLabel>);
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveAttribute("aria-label", "Advertisement");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test:run src/components/ads/__tests__/AdLabel.test.tsx`
Expected: FAIL — "Cannot find module '../AdLabel'".

- [ ] **Step 3: Implement AdLabel**

Create `src/components/ads/AdLabel.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function AdLabel({ children, className = "" }: Props) {
  const t = useTranslations("ads");
  const label = t("label");

  return (
    <aside
      aria-label={label}
      className={`ad-container border border-neutral-200 dark:border-neutral-800 rounded-md p-2 ${className}`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </div>
      {children}
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test:run src/components/ads/__tests__/AdLabel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ads/AdLabel.tsx src/components/ads/__tests__/AdLabel.test.tsx
git commit -m "feat(ads): add AdLabel component with locale-aware label"
```

---

## Task 3: AdSlot component (TDD)

**Files:**
- Create: `src/components/ads/AdSlot.tsx`
- Create: `src/components/ads/__tests__/AdSlot.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ads/__tests__/AdSlot.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, beforeEach, vi } from "vitest";

const messages = { ads: { label: "Advertisement" } };

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>,
  );
}

describe("AdSlot", () => {
  beforeEach(() => {
    vi.resetModules();
    (window as any).adsbygoogle = [];
  });

  it("renders nothing when ADSENSE_CLIENT_ID is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "");
    const { AdSlot } = await import("../AdSlot");
    const { container } = renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" />,
    );
    expect(container.firstChild).toBeNull();
    vi.unstubAllEnvs();
  });

  it("renders nothing when slot ID is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-0000");
    const slotsModule = await import("../../../lib/ads/slots");
    slotsModule.AD_SLOTS.headerLeaderboard = "";
    const { AdSlot } = await import("../AdSlot");
    const { container } = renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" />,
    );
    expect(container.firstChild).toBeNull();
    vi.unstubAllEnvs();
  });

  it("renders ins element with ad-client and ad-slot attributes when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-1234");
    const slotsModule = await import("../../../lib/ads/slots");
    slotsModule.AD_SLOTS.headerLeaderboard = "9999";
    const { AdSlot } = await import("../AdSlot");
    renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" loading="eager" />,
    );
    const ins = document.querySelector("ins.adsbygoogle");
    expect(ins).not.toBeNull();
    expect(ins).toHaveAttribute("data-ad-client", "ca-pub-1234");
    expect(ins).toHaveAttribute("data-ad-slot", "9999");
    expect(ins).toHaveAttribute("data-ad-format", "auto");
    expect(ins).toHaveAttribute("data-full-width-responsive", "true");
    vi.unstubAllEnvs();
  });

  it("calls adsbygoogle.push immediately when loading is eager", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-1234");
    const slotsModule = await import("../../../lib/ads/slots");
    slotsModule.AD_SLOTS.headerLeaderboard = "9999";
    const pushSpy = vi.fn();
    (window as any).adsbygoogle = { push: pushSpy };
    const { AdSlot } = await import("../AdSlot");
    renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" loading="eager" />,
    );
    expect(pushSpy).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test:run src/components/ads/__tests__/AdSlot.test.tsx`
Expected: FAIL — "Cannot find module '../AdSlot'".

- [ ] **Step 3: Implement AdSlot**

Create `src/components/ads/AdSlot.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { AD_SLOTS, ADSENSE_CLIENT_ID, type SlotFormat, type SlotName } from "@/lib/ads/slots";
import { AdLabel } from "./AdLabel";

type Props = {
  slotName: SlotName;
  format: SlotFormat;
  loading?: "eager" | "lazy";
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle?: { push: (obj: object) => void } | unknown[];
  }
}

const HEIGHT_BY_FORMAT: Record<SlotFormat, string> = {
  leaderboard: "min-h-[50px] md:min-h-[90px]",
  "in-article": "min-h-[280px]",
  "in-grid": "min-h-[280px]",
  "sticky-mobile": "min-h-[50px]",
};

export function AdSlot({ slotName, format, loading = "lazy", className = "" }: Props) {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);
  const slotId = AD_SLOTS[slotName];

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID || !slotId) return;
    if (pushedRef.current) return;

    const push = () => {
      if (pushedRef.current) return;
      try {
        const arr = ((window.adsbygoogle as unknown[]) ||= []);
        (arr as unknown[]).push({});
        pushedRef.current = true;
      } catch {
        // script blocked or not yet loaded — fail silently
      }
    };

    if (loading === "eager") {
      push();
      return;
    }

    if (!insRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          push();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(insRef.current);
    return () => observer.disconnect();
  }, [loading, slotId]);

  if (!ADSENSE_CLIENT_ID || !slotId) return null;

  return (
    <AdLabel className={className}>
      <ins
        ref={insRef}
        className={`adsbygoogle block ${HEIGHT_BY_FORMAT[format]}`}
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </AdLabel>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test:run src/components/ads/__tests__/AdSlot.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ads/AdSlot.tsx src/components/ads/__tests__/AdSlot.test.tsx
git commit -m "feat(ads): add AdSlot client component with eager/lazy init"
```

---

## Task 4: Load AdSense script in root frontend layout

**Files:**
- Modify: `src/app/(frontend)/layout.tsx`

- [ ] **Step 1: Read the current file**

Read `src/app/(frontend)/layout.tsx` — it currently exports `FrontendLayout` and renders `<html>/<body>` with `{children}`.

- [ ] **Step 2: Add the Script import and gated tag**

Replace the existing `src/app/(frontend)/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import React from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./styles.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MFM Sport",
  description: "Moroccan Football News Portal",
};

const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexArabic.variable} font-sans antialiased`}
      >
        {children}
        {adsenseClientId && (
          <Script
            id="adsbygoogle"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify dev server renders with env unset**

Run: `pnpm dev` (or ensure the existing dev server restarts).
Visit `http://localhost:3000/en`.
Expected: no network request to `pagead2.googlesyndication.com` (check DevTools Network tab).

- [ ] **Step 4: Stop the dev server and commit**

```bash
git add src/app/(frontend)/layout.tsx
git commit -m "feat(ads): load AdSense script in root layout (gated by env)"
```

---

## Task 5: Mount header leaderboard in locale layout

**Files:**
- Modify: `src/app/(frontend)/[locale]/layout.tsx`

- [ ] **Step 1: Read the current file**

Read `src/app/(frontend)/[locale]/layout.tsx`.

- [ ] **Step 2: Add AdSlot import and mount above Header**

Replace the file contents with:

```tsx
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AdSlot } from "@/components/ads/AdSlot";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const direction = locale === "ar" ? "rtl" : "ltr";
  const fontClass = locale === "ar" ? "font-arabic" : "font-sans";

  return (
    <div dir={direction} lang={locale} className={`${fontClass} min-h-screen flex flex-col`}>
      <NextIntlClientProvider messages={messages}>
        <div className="container mx-auto px-4 pt-2">
          <AdSlot slotName="headerLeaderboard" format="leaderboard" loading="eager" />
        </div>
        <Header locale={locale} />
        <main className="flex-1">{children}</main>
        <Footer locale={locale} />
      </NextIntlClientProvider>
    </div>
  );
}
```

- [ ] **Step 3: Verify no visual regression when ads disabled**

Run: `pnpm dev` and visit `http://localhost:3000/en` with `NEXT_PUBLIC_ADSENSE_CLIENT_ID` unset.
Expected: AdSlot returns null, so no empty "Advertisement" label appears above Header. Layout identical to before.

- [ ] **Step 4: Commit**

```bash
git add src/app/(frontend)/[locale]/layout.tsx
git commit -m "feat(ads): mount header leaderboard slot"
```

---

## Task 6: StickyMobileAd component (TDD)

**Files:**
- Create: `src/components/ads/StickyMobileAd.tsx`
- Create: `src/components/ads/__tests__/StickyMobileAd.test.tsx`
- Modify: `messages/ar.json`, `messages/fr.json`, `messages/en.json`

- [ ] **Step 1: Add `common.close` to all three message files**

In `messages/en.json`, inside the existing `common` object, add:

```json
    "close": "Close"
```

In `messages/fr.json`:

```json
    "close": "Fermer"
```

In `messages/ar.json`:

```json
    "close": "إغلاق"
```

- [ ] **Step 2: Write the failing test**

Create `src/components/ads/__tests__/StickyMobileAd.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, beforeEach, vi } from "vitest";

const messages = {
  ads: { label: "Advertisement" },
  common: { close: "Close" },
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>,
  );
}

describe("StickyMobileAd", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-1234");
  });

  it("renders when not previously dismissed", async () => {
    const slotsModule = await import("../../../lib/ads/slots");
    slotsModule.AD_SLOTS.stickyMobile = "5555";
    const { StickyMobileAd } = await import("../StickyMobileAd");
    renderWithIntl(<StickyMobileAd />);
    expect(screen.getByTestId("sticky-mobile-ad")).toBeInTheDocument();
  });

  it("hides itself when dismiss button is clicked and stores flag in sessionStorage", async () => {
    const slotsModule = await import("../../../lib/ads/slots");
    slotsModule.AD_SLOTS.stickyMobile = "5555";
    const { StickyMobileAd } = await import("../StickyMobileAd");
    renderWithIntl(<StickyMobileAd />);
    fireEvent.click(screen.getByRole("button", { name: /close|dismiss/i }));
    expect(screen.queryByTestId("sticky-mobile-ad")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("ad-sticky-dismissed")).toBe("1");
  });

  it("does not render when sessionStorage flag is set", async () => {
    sessionStorage.setItem("ad-sticky-dismissed", "1");
    const slotsModule = await import("../../../lib/ads/slots");
    slotsModule.AD_SLOTS.stickyMobile = "5555";
    const { StickyMobileAd } = await import("../StickyMobileAd");
    renderWithIntl(<StickyMobileAd />);
    expect(screen.queryByTestId("sticky-mobile-ad")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `pnpm test:run src/components/ads/__tests__/StickyMobileAd.test.tsx`
Expected: FAIL — "Cannot find module '../StickyMobileAd'".

- [ ] **Step 4: Implement StickyMobileAd**

Create `src/components/ads/StickyMobileAd.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AdSlot } from "./AdSlot";

const DISMISS_KEY = "ad-sticky-dismissed";

export function StickyMobileAd() {
  const t = useTranslations("common");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div
      data-testid="sticky-mobile-ad"
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-background border-t border-neutral-200 dark:border-neutral-800 p-1"
    >
      <button
        type="button"
        aria-label={t("close")}
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="absolute top-0 right-1 text-xs text-muted-foreground px-1"
      >
        ×
      </button>
      <AdSlot slotName="stickyMobile" format="sticky-mobile" loading="lazy" />
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify pass**

Run: `pnpm test:run src/components/ads/__tests__/StickyMobileAd.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/ads/StickyMobileAd.tsx src/components/ads/__tests__/StickyMobileAd.test.tsx messages/
git commit -m "feat(ads): add dismissible sticky mobile ad"
```

---

## Task 7: Mount StickyMobileAd in locale layout

**Files:**
- Modify: `src/app/(frontend)/[locale]/layout.tsx`

- [ ] **Step 1: Read the current file**

Read `src/app/(frontend)/[locale]/layout.tsx` (post Task 5).

- [ ] **Step 2: Add StickyMobileAd import and mount**

Add the import at the top (alongside `AdSlot`):

```tsx
import { StickyMobileAd } from "@/components/ads/StickyMobileAd";
```

Add the component inside `NextIntlClientProvider`, after `<Footer>`:

```tsx
        <Footer locale={locale} />
        <StickyMobileAd />
      </NextIntlClientProvider>
```

- [ ] **Step 3: Verify dev layout**

Run dev server, open `http://localhost:3000/en` in a mobile viewport (DevTools device mode).
Expected: layout unchanged with `NEXT_PUBLIC_ADSENSE_CLIENT_ID` unset; no sticky bar visible.

- [ ] **Step 4: Commit**

```bash
git add src/app/(frontend)/[locale]/layout.tsx
git commit -m "feat(ads): mount sticky mobile ad in locale layout"
```

---

## Task 8: InArticleAdInjector component (TDD)

**Files:**
- Create: `src/components/articles/InArticleAdInjector.tsx`
- Create: `src/components/articles/__tests__/InArticleAdInjector.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/articles/__tests__/InArticleAdInjector.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, vi } from "vitest";

vi.mock("@payloadcms/richtext-lexical/react", () => ({
  RichText: ({ data }: { data: any }) => (
    <div data-testid="richtext" data-count={data?.root?.children?.length ?? 0} />
  ),
}));

vi.mock("../../ads/AdSlot", () => ({
  AdSlot: () => <div data-testid="ad-slot" />,
}));

const messages = { ads: { label: "Advertisement" } };

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>,
  );
}

describe("InArticleAdInjector", () => {
  it("renders single RichText (no ad) when content has no paragraphs", async () => {
    const { InArticleAdInjector } = await import("../InArticleAdInjector");
    const content = { root: { children: [{ type: "heading" }] } };
    const { queryAllByTestId } = renderWithIntl(
      <InArticleAdInjector content={content} />,
    );
    expect(queryAllByTestId("richtext")).toHaveLength(1);
    expect(queryAllByTestId("ad-slot")).toHaveLength(0);
  });

  it("renders single RichText when only one node remains after first paragraph", async () => {
    const { InArticleAdInjector } = await import("../InArticleAdInjector");
    const content = { root: { children: [{ type: "paragraph" }] } };
    const { queryAllByTestId } = renderWithIntl(
      <InArticleAdInjector content={content} />,
    );
    expect(queryAllByTestId("richtext")).toHaveLength(1);
    expect(queryAllByTestId("ad-slot")).toHaveLength(0);
  });

  it("splits content and injects ad after first paragraph", async () => {
    const { InArticleAdInjector } = await import("../InArticleAdInjector");
    const content = {
      root: {
        children: [
          { type: "paragraph", id: "p1" },
          { type: "paragraph", id: "p2" },
          { type: "paragraph", id: "p3" },
        ],
      },
    };
    const { queryAllByTestId } = renderWithIntl(
      <InArticleAdInjector content={content} />,
    );
    const richTexts = queryAllByTestId("richtext");
    expect(richTexts).toHaveLength(2);
    expect(richTexts[0]).toHaveAttribute("data-count", "1");
    expect(richTexts[1]).toHaveAttribute("data-count", "2");
    expect(queryAllByTestId("ad-slot")).toHaveLength(1);
  });

  it("renders nothing (gracefully) when content is null", async () => {
    const { InArticleAdInjector } = await import("../InArticleAdInjector");
    const { container } = renderWithIntl(<InArticleAdInjector content={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test:run src/components/articles/__tests__/InArticleAdInjector.test.tsx`
Expected: FAIL — "Cannot find module '../InArticleAdInjector'".

- [ ] **Step 3: Implement InArticleAdInjector**

Create `src/components/articles/InArticleAdInjector.tsx`:

```tsx
import { RichText } from "@payloadcms/richtext-lexical/react";
import { AdSlot } from "@/components/ads/AdSlot";

type Props = {
  content: any;
};

export function InArticleAdInjector({ content }: Props) {
  if (!content?.root?.children) return null;

  const children = content.root.children as any[];
  const firstParagraphIndex = children.findIndex((node) => node.type === "paragraph");

  // No paragraph, or first paragraph is the last node → no split, no ad.
  if (firstParagraphIndex === -1 || firstParagraphIndex >= children.length - 1) {
    return <RichText data={content} />;
  }

  const before = {
    ...content,
    root: { ...content.root, children: children.slice(0, firstParagraphIndex + 1) },
  };
  const after = {
    ...content,
    root: { ...content.root, children: children.slice(firstParagraphIndex + 1) },
  };

  return (
    <>
      <div className="prose prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground leading-arabic">
        <RichText data={before} />
      </div>
      <AdSlot slotName="inArticleMid" format="in-article" loading="lazy" className="my-6" />
      <div className="prose prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground leading-arabic">
        <RichText data={after} />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test:run src/components/articles/__tests__/InArticleAdInjector.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/articles/InArticleAdInjector.tsx src/components/articles/__tests__/InArticleAdInjector.test.tsx
git commit -m "feat(ads): add InArticleAdInjector that splits Lexical body"
```

---

## Task 9: Wire in-article slots into article detail page

**Files:**
- Modify: `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`

- [ ] **Step 1: Read the current file**

Read `src/app/(frontend)/[locale]/articles/[slug]/page.tsx`.

- [ ] **Step 2: Replace `<ArticleBody>` usage + add bottom slot**

Change the imports:

```tsx
import { ArticleBody } from "@/components/articles/ArticleBody";
```

to:

```tsx
import { InArticleAdInjector } from "@/components/articles/InArticleAdInjector";
import { AdSlot } from "@/components/ads/AdSlot";
```

Replace the `<ArticleBody content={article.body} />` line with:

```tsx
      <InArticleAdInjector content={article.body} />
```

After the tags block (the `{article.tags && ...}` section, just before `{related && ...}`), insert the bottom ad slot:

```tsx
      <AdSlot slotName="inArticleBottom" format="in-article" loading="lazy" className="my-8" />
```

Note: `ArticleBody` is no longer used on this page. Leave the file (it may be imported elsewhere); verify by running:

Run: `pnpm exec grep -r "ArticleBody" src/ --include="*.tsx" --include="*.ts"` (or equivalent).

If `ArticleBody` is only imported on this one page, remove the file in a follow-up commit. For now leave it to avoid scope creep.

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Smoke-test in dev**

Run: `pnpm dev` and visit a demo article page (e.g., `http://localhost:3000/en/articles/demo-...`).
Expected: body renders exactly as before (ad slot collapses to null with env unset).

- [ ] **Step 5: Commit**

```bash
git add src/app/(frontend)/[locale]/articles/[slug]/page.tsx
git commit -m "feat(ads): inject mid-article + bottom slots on article detail page"
```

---

## Task 10: Add `withAds` to ArticleGrid

**Files:**
- Modify: `src/components/articles/ArticleGrid.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/articles/ArticleGrid.tsx`.

- [ ] **Step 2: Replace with ads-capable version**

Replace `src/components/articles/ArticleGrid.tsx` with:

```tsx
import { Fragment } from "react";
import { ArticleCard } from "./ArticleCard";
import { AdSlot } from "@/components/ads/AdSlot";

type Props = {
  articles: any[];
  locale: string;
  columns?: 2 | 3 | 4;
  withAds?: boolean;
};

const AD_EVERY = 8;

export function ArticleGrid({ articles, locale, columns = 3, withAds = false }: Props) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {articles.map((article, index) => {
        const insertAdAfter =
          withAds && (index + 1) % AD_EVERY === 0 && index !== articles.length - 1;
        return (
          <Fragment key={article.id}>
            <ArticleCard article={article} locale={locale} />
            {insertAdAfter && (
              <div className="col-span-full">
                <AdSlot slotName="inGrid" format="in-grid" loading="lazy" />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/articles/ArticleGrid.tsx
git commit -m "feat(ads): add optional withAds prop to ArticleGrid"
```

---

## Task 11: Enable `withAds` on list pages

**Files:**
- Modify: `src/app/(frontend)/[locale]/articles/page.tsx`
- Modify: `src/app/(frontend)/[locale]/category/[slug]/page.tsx`
- Modify: `src/app/(frontend)/[locale]/tag/[slug]/page.tsx`

- [ ] **Step 1: Pass `withAds` to the grid on the articles list page**

In `src/app/(frontend)/[locale]/articles/page.tsx`, find:

```tsx
          <ArticleGrid articles={result.docs} locale={locale} columns={3} />
```

Replace with:

```tsx
          <ArticleGrid articles={result.docs} locale={locale} columns={3} withAds />
```

- [ ] **Step 2: Pass `withAds` on the category page**

In `src/app/(frontend)/[locale]/category/[slug]/page.tsx`, find the same line and replace the same way.

- [ ] **Step 3: Pass `withAds` on the tag page**

In `src/app/(frontend)/[locale]/tag/[slug]/page.tsx`, find the same line and replace the same way.

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Smoke-test in dev**

Run: `pnpm dev`. Visit `/en/articles`, `/en/category/<slug>`, `/en/tag/<slug>`.
Expected: pages render unchanged with env unset. Cards still flow as 3-column grid.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(frontend\)/\[locale\]/articles/page.tsx src/app/\(frontend\)/\[locale\]/category/\[slug\]/page.tsx src/app/\(frontend\)/\[locale\]/tag/\[slug\]/page.tsx
git commit -m "feat(ads): enable between-grid ads on articles, category, tag pages"
```

---

## Task 12: Hide unfilled slots via CSS + update privacy page note

**Files:**
- Modify: `src/app/(frontend)/styles.css`
- Modify: privacy page content (already seeded) — optional

- [ ] **Step 1: Locate the global stylesheet**

Read `src/app/(frontend)/styles.css`. This is the stylesheet imported by the root frontend layout.

- [ ] **Step 2: Append the unfilled-slot CSS rule**

Append to the end of `src/app/(frontend)/styles.css`:

```css
/* Hide ad container when AdSense reports the slot as unfilled. */
.ad-container:has(ins.adsbygoogle[data-ad-status="unfilled"]) {
  display: none;
}
```

- [ ] **Step 3: Privacy page update (deferred)**

The seeded privacy page should mention AdSense cookies once ads go live. Leave a TODO-free note in this plan:

*After AdSense approval, edit the privacy page in Payload admin to add a "Third-party advertising" section referencing Google AdSense cookies and the Funding Choices consent banner. No code change.*

- [ ] **Step 4: Commit**

```bash
git add src/app/\(frontend\)/styles.css
git commit -m "feat(ads): hide ad containers when AdSense reports unfilled"
```

---

## Task 13: Final verification

**Files:** none

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test:run`
Expected: all ad-related tests pass, no pre-existing tests broken.

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Dev smoke test with ads enabled**

Set `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-1234567890` temporarily in `.env.local` (use a fake ID — real one not yet issued).
Run: `pnpm dev` and open `http://localhost:3000/en`.

Expected checklist:
- Script request to `pagead2.googlesyndication.com` appears in Network tab.
- Above-header container renders with "Advertisement" label and reserved height (empty because no real slot ID).
- Sticky mobile bar visible on mobile viewport; dismiss `×` hides it for the session.
- Article detail page shows label at mid-article position and before related articles.
- Articles list page shows labels after every 8 cards.

Remove the fake env after the check. Do NOT commit `.env.local`.

- [ ] **Step 5: Final commit only if something drifted**

If typecheck/lint/tests surfaced anything that needed fixing, commit the fix now. Otherwise, no commit.

---

## Spec-coverage check

Every spec section mapped to tasks:

- **Ad source AdSense** → Task 4 (script loading) + Task 1 (env var + ads.txt)
- **Slot inventory a/c/d/e/f** → Tasks 5, 9, 10-11, 7
- **Manual responsive units** → Task 3 (`data-ad-format="auto"` + `data-full-width-responsive="true"`)
- **CMP Funding Choices** → documented in spec as "configured in AdSense dashboard" — no code change required
- **Hardcoded slots for MVP** → Tasks 5, 7, 9, 10-11 all hardcode positions
- **Per-locale label** → Tasks 1 (translations) + 2 (AdLabel) + 3 (AdSlot uses AdLabel)
- **Script loading eager/lazy** → Task 3 (eager + IntersectionObserver)
- **Gated by env var** → Tasks 1, 3, 4
- **Reserved heights / CLS** → Task 3 (HEIGHT_BY_FORMAT map)
- **Empty-slot hiding** → Task 12 (CSS `:has()` rule)
- **ads.txt** → Task 1

## Post-launch follow-ups (not in this plan)

- Apply to AdSense once WP migration is live and traffic accumulates.
- Fill `ADSense` slot IDs in `src/lib/ads/slots.ts` after approval.
- Replace `pub-XXXXXXXXXXXXXXXX` in `public/ads.txt` with real publisher ID.
- Add privacy-page section about AdSense (via Payload admin).
- Consider removing `src/components/articles/ArticleBody.tsx` if no longer referenced.
