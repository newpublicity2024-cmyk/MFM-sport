# Disable Next.js / Vercel Image Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the live site from hitting Vercel's image-optimization quota by serving all images directly (unoptimized), so images always render.

**Architecture:** Next.js routes every `<Image>` through Vercel's `/_next/image` optimizer by default. Once the plan's monthly optimization quota is exhausted, the optimizer returns 402/error responses and images break. Setting `images.unoptimized: true` in `next.config.ts` makes `next/image` emit the original `src` directly (no `/_next/image` proxy, no quota). All existing `<Image>` components keep working unchanged because they already pass `width`/`height`/`fill`.

**Tech Stack:** Next.js 16 (App Router), Payload CMS wrapper (`withPayload`), `next-intl` plugin, deployed on Vercel.

---

### Task 1: Disable image optimization in next.config.ts

**Files:**
- Modify: `next.config.ts:13-36` (the `images` config block)

- [ ] **Step 1: Confirm the current images block**

Run: `git show HEAD:next.config.ts`
Expected: the `images` object contains `remotePatterns` and `localPatterns`, and does NOT contain `unoptimized`.

- [ ] **Step 2: Add the `unoptimized` flag**

Edit `next.config.ts`. Change the opening of the `images` block from:

```ts
  images: {
    remotePatterns: [
```

to:

```ts
  images: {
    // Serve images directly without Vercel's optimizer.
    // Prevents exhausting the image-optimization quota (which made images fail to load).
    unoptimized: true,
    remotePatterns: [
```

Leave `remotePatterns` and `localPatterns` exactly as they are — they are harmless when `unoptimized` is true and keep the config valid if optimization is ever re-enabled.

- [ ] **Step 3: Type-check the config and project**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (no errors). `unoptimized` is a valid key on Next's `ImageConfig`, so the typed `NextConfig` still compiles.

- [ ] **Step 4: Build to verify the config loads**

Run: `pnpm build`
Expected: Build completes successfully. No warnings about the `images` config being invalid.

- [ ] **Step 5: Verify optimizer is bypassed locally**

Run: `pnpm start` (in a second terminal if needed), then open the homepage.

Verify in browser DevTools → Network tab: image requests go directly to their source URLs (e.g. `media.api-sports.io/...`, `i.ytimg.com/...`, `/api/media/file/...`, `/images/...`) and **NOT** to `/_next/image?url=...`.
Expected: Zero requests to `/_next/image`. Images render.

(Manual visual check — there is no unit test for a build-config flag.)

- [ ] **Step 6: Commit**

```bash
git add next.config.ts
git commit -m "fix(images): disable Vercel image optimization to stop quota-related image failures"
```

---

### Task 2: Ship to production and verify on the live site

**Files:**
- None (deploy + verification only)

- [ ] **Step 1: Push and open a PR**

`main` is PR-protected. Push the branch and open a PR.

```bash
git push -u origin HEAD
```

Then open a PR via the GitHub CLI or MCP, titled `fix(images): disable image optimization (serve images directly)`.

- [ ] **Step 2: Merge the PR**

Merge once CI is green. Vercel auto-deploys `main` to production.

- [ ] **Step 3: Verify on the production alias**

Open `https://mfm-sport-kappa.vercel.app` (the prod alias).

Verify in DevTools → Network:
- Image requests resolve directly from source hosts / `/api/media/file/...` / `/images/...`.
- No requests to `/_next/image`.
- No 402 / error responses on image requests.

Expected: All homepage, article, and football images render. The Vercel project's Image Optimization usage stops increasing.

- [ ] **Step 4: Confirm quota is no longer consumed**

In the Vercel dashboard → project `mfm-sport` → Usage → Image Optimization: confirm new transformations have stopped (the counter plateaus after deploy).

---

## Notes / Tradeoffs

- **What you lose:** automatic WebP/AVIF conversion and on-the-fly resizing. Browsers now download the original asset at full size. For this site the sources are already reasonably sized (API logos, YouTube thumbnails, Payload media), so the impact is small and far preferable to broken images.
- **Reversible:** delete the `unoptimized: true` line to restore optimization. Consider this only after the quota concern is solved (higher Vercel plan or an external image CDN via `images.loader`).
- **No component changes needed:** every existing `next/image` usage already supplies `width`/`height` or `fill`, which is all `unoptimized` mode requires.

## Self-Review

- **Spec coverage:** Request = "deactivate image optimization so images display directly." Task 1 deactivates it globally; Task 2 verifies on the live Vercel site. Covered.
- **Placeholders:** none — exact file, exact lines, exact code shown.
- **Type consistency:** single `unoptimized: true` boolean key on the existing `images` object; no cross-task identifiers to drift.
