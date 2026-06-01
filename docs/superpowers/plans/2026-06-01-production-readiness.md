# MFM Sport — Production Readiness Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Save final copy to:** `docs/superpowers/plans/2026-06-01-production-readiness.md` (this `.claude/plans` file is the plan-mode draft).

**Goal:** Take the feature-complete MFM Sport site from "preview" to a safely launchable production website by closing the launch-blocking and hardening gaps, then importing real content.

**Architecture:** No new features. Add production error/loading UX, security headers + rate limiting + input validation, a CI gate, Sentry enablement, and execute the WordPress content migration. AdSense activation is explicitly deferred to post-launch.

**Tech Stack:** Next.js 16.2.4 (App Router), Payload CMS 3.84.0, Neon Postgres, Vercel Blob, next-intl (AR/FR/EN), Vitest + Playwright, Sentry, Resend, API-Football.

---

## Context

**Why this plan exists:** The user asked where the project stopped and what remains before production. Investigation (git history + full codebase map + production audit) shows the *build* is essentially done — every roadmap plan shipped in code even though none of the plan checkboxes were ever ticked. What remains is **production hardening + real content**, not feature work.

### What is DONE (verified in code on `main`)

All 17 plans in `docs/superpowers/plans/` are implemented (checkboxes were never marked, but the code exists):

- **Foundation & CMS** — 11 Payload collections (Articles, Authors, Categories, Tags, Media, Clubs, Competitions, Subscribers, Pages, Redirects, Users), Postgres + Vercel Blob, auth + roles.
- **Editorial pages** — home, articles list/detail, author, category, tag, search, about, contact, privacy, legal, RSS feed (`feed.xml`).
- **Football data** — competitions, clubs, matches list/detail, standings, lineups, stats, live scoreboard via API-Football (`src/lib/api-football/`, `src/hooks/useFixture`, `useLiveFixtures`, `/api/fixtures/*`).
- **Engagement** — newsletter subscribe/confirm/unsubscribe (Resend), OG image generation (`/api/og`).
- **SEO** — `robots.ts`, `sitemap.ts` (all 3 locales), `generateMetadata` across routes, favicons.
- **i18n** — next-intl AR(default)/FR/EN with RTL.
- **Polish iterations** — light mode + light default, BrandLogo, homepage matches panel + status filter, leagues & videos sections, overlap/hydration fixes, runtime error fixes.
- **Ads infrastructure** — `feat/ad-banners` is **already merged into `main`** (`git log main..feat/ad-banners` is empty). Components `AdSlot`, `AdLabel`, `StickyMobileAd`, `InArticleAdInjector` exist; only slot IDs + approval are pending. (Memory note calling this branch "unmerged" is stale.)
- **Tests** — ~25 test files (Vitest unit/component + Playwright e2e).
- **Deployment scaffolding** — `Dockerfile`, `.vercelignore`, `next.config.ts` image patterns, migration + seed scripts.

### What is LEFT (the scope of this plan)

| Gap | Evidence | Phase |
|-----|----------|-------|
| No error/loading UX | `Glob` for `error.tsx`/`global-error.tsx`/`loading.tsx` → **0 files** | 1 |
| No security headers | `next.config.ts` has no `headers()`; `middleware.ts` does i18n only | 2 |
| No rate limiting / weak input validation | `/api/newsletter/subscribe`, `/api/og`, `/api/redirects` unprotected | 2 |
| Production env not set | `.env` `NEXT_PUBLIC_SITE_URL=http://localhost:3000`; `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN` empty | 3 |
| No CI gate | No `.github/workflows/` | 3 |
| Sentry effectively off | DSN unset → no production error tracking | 4 |
| Only demo content | No real articles; `scripts/migrate-wp.ts` ready but unexecuted | 5 |
| No final launch verification | — | 6 |

**Deferred to post-launch (user decision):** AdSense activation (needs a live site with real content to even apply), advanced test-coverage expansion, performance micro-tuning.

---

## File Structure (new/modified)

**Create:**
- `src/app/global-error.tsx` — top-level React error boundary (Sentry-reporting)
- `src/app/(frontend)/[locale]/error.tsx` — localized route error boundary
- `src/app/(frontend)/[locale]/loading.tsx` — route-level skeleton
- `src/lib/rate-limit.ts` — shared rate-limit helper (graceful no-op without Upstash creds)
- `.github/workflows/ci.yml` — lint + test + build gate

**Modify:**
- `next.config.ts` — add `headers()` for security headers
- `src/app/api/newsletter/subscribe/route.ts` — apply rate limit + stricter email validation
- `src/app/api/og/route.tsx` — clamp/validate `title` length
- `src/app/api/redirects/route.ts` — bound `from` length
- `.env.example` — document production values (no secrets committed)

---

## Phase 1: Production Error & Loading UX

### Task 1: Global error boundary

**Files:**
- Create: `src/app/global-error.tsx`

- [ ] **Step 1: Write `global-error.tsx`** (client component, full html/body — it replaces the root layout when the root crashes)

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>حدث خطأ ما</h1>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          Something went wrong. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{ padding: "0.6rem 1.4rem", borderRadius: "8px", border: "1px solid #ccc", cursor: "pointer" }}
        >
          إعادة المحاولة / Retry
        </button>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build` (or `pnpm lint`)
Expected: no type/lint error for the new file.

- [ ] **Step 3: Commit**

```bash
git add src/app/global-error.tsx
git commit -m "feat(error): add global-error boundary with Sentry reporting"
```

### Task 2: Localized route error boundary

**Files:**
- Create: `src/app/(frontend)/[locale]/error.tsx`

- [ ] **Step 1: Write `error.tsx`** (client component; uses next-intl `useTranslations` if a key exists, else inline copy)

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">حدث خطأ ما</h1>
      <p className="text-muted-foreground">Something went wrong loading this page.</p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md border px-4 py-2 hover:bg-muted"
        >
          إعادة المحاولة
        </button>
        <Link href="/" className="rounded-md border px-4 py-2 hover:bg-muted">
          الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `pnpm lint` passes.
- [ ] **Step 3: Commit**

```bash
git add "src/app/(frontend)/[locale]/error.tsx"
git commit -m "feat(error): add localized route error boundary"
```

### Task 3: Route loading skeleton

**Files:**
- Create: `src/app/(frontend)/[locale]/loading.tsx`

- [ ] **Step 1: Write `loading.tsx`** (reuse the existing `Skeleton` UI primitive from `src/components/ui/skeleton`)

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify** the import path matches the real file — confirm `src/components/ui/skeleton.tsx` exports `Skeleton`. Run `pnpm lint`.
- [ ] **Step 3: Commit**

```bash
git add "src/app/(frontend)/[locale]/loading.tsx"
git commit -m "feat(ux): add route-level loading skeleton"
```

---

## Phase 2: Security Hardening

### Task 4: Security headers

**Files:**
- Modify: `next.config.ts:12-49` (add an async `headers()` to `nextConfig`)

> **Caution:** A strict `Content-Security-Policy` will break the Payload admin (`/admin`), the Lexical editor, YouTube embeds, API-Football images, and (later) AdSense. Ship the safe headers globally now; introduce CSP as **Report-Only** so it never blocks, and tighten later.

- [ ] **Step 1: Add `headers()` to `nextConfig`** (insert before the closing brace of the config object)

```ts
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
    ];
    return [
      {
        // Apply to everything EXCEPT the Payload admin, which needs framing/eval freedom.
        source: "/((?!admin).*)",
        headers: securityHeaders,
      },
    ];
  },
```

- [ ] **Step 2: Verify locally** — run `pnpm dev`, then:

Run: `curl -sI http://localhost:3000/ar | findstr /I "x-content-type x-frame referrer strict-transport"`
Expected: the four/five headers present on a frontend route.

- [ ] **Step 3: Confirm admin still loads** — open `http://localhost:3000/admin` in a browser; the dashboard + Lexical editor must render normally.
- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): add baseline security headers (admin excluded)"
```

### Task 5: Rate-limit helper + apply to newsletter

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `src/lib/__tests__/rate-limit.test.ts`
- Modify: `src/app/api/newsletter/subscribe/route.ts:7-13`

> **Why Upstash:** Vercel runs each request in a separate serverless instance, so an in-memory counter does not limit anything across instances. `@upstash/ratelimit` + Upstash Redis is the standard Next.js-on-Vercel solution. The helper **no-ops when the env vars are absent** so local/dev and CI never break.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../rate-limit";

describe("checkRateLimit", () => {
  it("allows requests when Upstash is not configured (no-op fallback)", async () => {
    const res = await checkRateLimit("test-key");
    expect(res.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — fails** (`checkRateLimit` undefined)

Run: `pnpm test:run src/lib/__tests__/rate-limit.test.ts`
Expected: FAIL — "Cannot find module '../rate-limit'".

- [ ] **Step 3: Implement `src/lib/rate-limit.ts`**

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const limiter = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "mfm-rl",
    })
  : null;

export async function checkRateLimit(
  identifier: string,
): Promise<{ success: boolean }> {
  if (!limiter) return { success: true }; // graceful no-op without creds
  const { success } = await limiter.limit(identifier);
  return { success };
}
```

- [ ] **Step 4: Install deps**

Run: `pnpm add @upstash/ratelimit @upstash/redis`

- [ ] **Step 5: Run test — passes**

Run: `pnpm test:run src/lib/__tests__/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 6: Apply in the newsletter route** — at the top of `POST`, before parsing body, add IP-based limiting and tighten the email check:

```ts
import { checkRateLimit } from "@/lib/rate-limit";
// ... inside POST, first lines of the try block:
const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
const { success } = await checkRateLimit(`newsletter:${ip}`);
if (!success) {
  return NextResponse.json({ error: "Too many requests" }, { status: 429 });
}
```

Replace the loose check on line 11 with a real email regex:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
  return NextResponse.json({ error: "Invalid email" }, { status: 400 });
}
```

- [ ] **Step 7: Verify** — `pnpm test:run` (all pass), `pnpm lint`.
- [ ] **Step 8: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/__tests__/rate-limit.test.ts src/app/api/newsletter/subscribe/route.ts package.json pnpm-lock.yaml
git commit -m "feat(security): add rate-limit helper and apply to newsletter subscribe"
```

### Task 6: Bound untrusted query params (OG + redirects)

**Files:**
- Modify: `src/app/api/og/route.tsx`
- Modify: `src/app/api/redirects/route.ts:7-11`

- [ ] **Step 1: Clamp the OG `title`** — after reading the `title` searchParam in `src/app/api/og/route.tsx`, clamp length to avoid abuse/oversized renders:

```ts
const rawTitle = searchParams.get("title") ?? "MFM Sport";
const title = rawTitle.slice(0, 120);
```

- [ ] **Step 2: Bound the redirects `from`** — in `src/app/api/redirects/route.ts`, reject overly long input:

```ts
const from = searchParams.get("from");
if (!from || from.length > 512) {
  return NextResponse.json({ to: null });
}
```

- [ ] **Step 3: Verify** — `pnpm lint`; spot-check `http://localhost:3000/api/og?title=hello` returns an image.
- [ ] **Step 4: Commit**

```bash
git add src/app/api/og/route.tsx src/app/api/redirects/route.ts
git commit -m "feat(security): bound untrusted query params on og and redirects routes"
```

---

## Phase 3: Environment & Deployment Config

### Task 7: Production environment configuration

**Files:**
- Modify: `.env.example` (documentation only — never commit real secrets)
- Vercel dashboard (manual — not a code change)

- [ ] **Step 1: Document the new + production-required vars in `.env.example`** — append the Upstash keys and clarify production values:

```bash
# Rate limiting (Upstash Redis) — optional in dev, required in prod for limits to apply
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

And update the site URL comment to make the production value explicit:

```bash
# Site — set to the live origin in production, e.g. https://mfmsport.ma
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Set production env vars in Vercel** (Project → Settings → Environment Variables, "Production" scope). Required:
  - `DATABASE_URL` (Neon production branch)
  - `PAYLOAD_SECRET` (64-char random, **rotate** from dev value)
  - `BLOB_READ_WRITE_TOKEN` (create a Vercel Blob store first)
  - `NEXT_PUBLIC_SITE_URL=https://mfmsport.ma`
  - `NEXT_PUBLIC_SENTRY_DSN` (from the Sentry project — Task 9)
  - `API_FOOTBALL_KEY`, `RESEND_API_KEY`, `REVALIDATION_SECRET`
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - Leave `NEXT_PUBLIC_ADSENSE_CLIENT_ID` **unset** (deferred).

- [ ] **Step 3: Verify** — `git grep -n "localhost:3000" src/` returns no hardcoded production-path usages (only env-driven). Confirm code reads `process.env.NEXT_PUBLIC_SITE_URL` for canonical URLs (sitemap, OG, RSS).
- [ ] **Step 4: Commit** (docs only)

```bash
git add .env.example
git commit -m "docs(env): document Upstash + production site URL requirements"
```

### Task 8: CI gate (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow** — lint + unit tests + build on PRs and pushes to `main`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test:run
      - run: pnpm build
        env:
          # Build needs these present; use throwaway/CI-safe values.
          DATABASE_URL: ${{ secrets.CI_DATABASE_URL }}
          PAYLOAD_SECRET: ci-only-secret-not-used-at-runtime-0000000000000000
          NEXT_PUBLIC_SITE_URL: http://localhost:3000
```

> Note: if `pnpm build` requires a live DB connection (Payload may need it for type/schema steps), either provide a CI Neon branch via `CI_DATABASE_URL` secret or drop the `build` step from CI and rely on Vercel's build. Confirm during Step 2.

- [ ] **Step 2: Verify** — push a branch, open a PR, confirm the Action runs green (or adjust the build step per the note).
- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint + test + build workflow"
```

---

## Phase 4: Sentry Enablement

### Task 9: Turn on production error tracking

**Files:**
- Verify: `sentry.client.config.ts`, `sentry.server.config.ts`, and instrumentation hookup
- Vercel env: `NEXT_PUBLIC_SENTRY_DSN` (set in Task 7)

- [ ] **Step 1: Create the Sentry project** (org dashboard) and copy the DSN.
- [ ] **Step 2: Confirm wiring** — verify the two config files read the DSN from `process.env.NEXT_PUBLIC_SENTRY_DSN` and that `global-error.tsx`/`error.tsx` (Tasks 1–2) call `Sentry.captureException`. Confirm an `instrumentation.ts` (or Sentry's Next.js auto-instrumentation) is present so server errors are captured.
- [ ] **Step 3: Verify after deploy** — trigger a deliberate test error on a preview deployment and confirm it appears in Sentry. Remove the test trigger.
- [ ] **Step 4: Commit** (only if config edits were needed)

```bash
git add sentry.client.config.ts sentry.server.config.ts instrumentation.ts
git commit -m "feat(observability): enable Sentry error capture in production"
```

---

## Phase 5: Content — WordPress Migration

> Goal: import ~200 real articles + media + legacy redirects so the site launches credible (and becomes AdSense-eligible later). Script `scripts/migrate-wp.ts` is ready and idempotent; `WP_API_URL` is set.

### Task 10: Dry-run sample

- [ ] **Step 1: Run the built-in sample dry run**

Run: `pnpm migrate:wp:sample`  (= `--dry-run --limit=10`)
Expected: logs 10 candidate articles, media URLs, and redirect mappings with **no DB writes**. Review for HTML→Lexical conversion issues, image hosts, author mapping.

- [ ] **Step 2: Confirm image hosts are allowed** — any external image domain in the dry-run output must be in `next.config.ts` `images.remotePatterns`. Add hosts if needed (e.g. `mfmsport.ma`) and commit.

### Task 11: Execute the real migration

- [ ] **Step 1: Back up / snapshot** the Neon production branch (Neon dashboard → branch/restore point) before writing.
- [ ] **Step 2: Run the migration against production DB** (cap at the agreed ~200)

Run: `pnpm migrate:wp -- --limit=200`
Expected: articles created, media uploaded to Vercel Blob, redirects created. Re-running is safe (idempotent dedup via `wpUrl`/slug).

- [ ] **Step 3: Verify in admin** — open `/admin`, confirm Articles count ≈ 200, spot-check 5 articles for body formatting, featured image, author, category, and that localized fields populated. Confirm Redirects collection has legacy→new entries.
- [ ] **Step 4: Verify redirects resolve** — hit a known legacy WP path on the deployed site; confirm 301 to the new URL (exercises `middleware.ts` → `/api/redirects`).
- [ ] **Step 5: Revalidate / confirm pages render** — visit several imported articles on the live frontend in AR/FR/EN; confirm images load and no Lexical render errors.

> No commit — this is data, not code. Record the executed command + counts in `PROJECT_MEMORY.md` / a memory note.

---

## Phase 6: Pre-Launch Verification

### Task 12: Full launch checklist

- [ ] **Step 1: Green build + tests + lint**

Run: `pnpm lint && pnpm test:run && pnpm build`
Expected: all pass, build completes.

- [ ] **Step 2: E2E smoke** (against a preview deploy or local prod build)

Run: `pnpm test:int` and the Playwright e2e suite in `tests/e2e/`.
Expected: admin login + frontend nav specs pass.

- [ ] **Step 3: SEO endpoints** — on the production/preview origin verify:
  - `/robots.txt` disallows `/admin`,`/api` and references the sitemap with the **production** host.
  - `/sitemap.xml` lists all three locales and uses `https://mfmsport.ma` URLs (not localhost).
  - `/ar/feed.xml`, `/fr/feed.xml`, `/en/feed.xml` return valid RSS.
  - A sample article's `<head>` has correct canonical, OG image (`/api/og`), and hreflang alternates.

- [ ] **Step 4: Security headers in prod** — `curl -sI https://<preview-domain>/ar` shows the Task 4 headers; `/admin` still works.

- [ ] **Step 5: Manual cross-locale QA** — home, article, club, competition, matches (live panel), search, newsletter signup (confirm email arrives via Resend), 404, error page, light/dark toggle — in AR (RTL), FR, EN, desktop + mobile widths.

- [ ] **Step 6: Sentry receiving events** (from Task 9 Step 3).

- [ ] **Step 7: DNS + domain** — point `mfmsport.ma` to Vercel (A/CNAME per Vercel domain settings), confirm HTTPS cert issued, confirm `NEXT_PUBLIC_SITE_URL` matches the live origin.

- [ ] **Step 8: Final go/no-go** — confirm all production env vars set, ad slots intentionally empty (AdSense deferred), content present. Launch.

---

## Post-Launch Follow-ups (out of scope, tracked here)

1. **AdSense activation** — apply once the site is live with real content; fill `public/ads.txt` publisher ID, set `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, populate slot IDs in `src/lib/ads/slots.ts`.
2. **Tighten CSP** — promote the Report-Only CSP to enforced after validating against admin, YouTube embeds, API-Football images, and AdSense.
3. **Paid-tier API quotas** — upgrade API-Football (free 100/day) and Resend (free 100/day) as traffic grows.
4. **Test-coverage expansion** and performance micro-tuning.

---

## Verification (end-to-end summary)

The plan is complete when, on the production origin:
- `pnpm lint && pnpm test:run && pnpm build` are green and CI enforces them;
- branded error + loading UX renders (force an error; throttle network);
- security headers present on frontend, admin unaffected;
- newsletter endpoint returns 429 under burst (with Upstash configured);
- ~200 real articles render across AR/FR/EN with working images and legacy redirects;
- sitemap/robots/RSS/OG all use the live host;
- Sentry receives a test event;
- domain serves over HTTPS with the correct canonical origin.
