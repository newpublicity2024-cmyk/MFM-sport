# Latest News Playlist Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the blank space under the leagues selector in the homepage "Latest News by League" section with a stylish, clickable banner image that opens a YouTube playlist in a new tab.

**Architecture:** Add a new self-contained `LeaguePlaylistBanner` client component that renders `public/images/box-banner.jpg` as a rounded, bordered card wrapped in an external `<a>` link. Place it directly below `LeaguesPanel` inside the right-hand column of `LeagueNewsSection`, converting that column to a vertical flex stack. The banner URL and image are module-level constants (the user will swap them later). Localized alt/aria-label text lives in a small in-component map, matching the existing `pickName` locale-switch pattern in `LeaguesPanel` (these home components receive i18n as plain data, not via hooks).

**Tech Stack:** Next.js 16.2.4 (App Router, React 19), TypeScript 5.7, Tailwind CSS 3.4 (HSL token system), `next/image`, Vitest 3 + @testing-library/react (jsdom).

---

## Context the engineer needs

- **Section being modified:** [src/components/home/LeagueNewsSection.tsx](../../../src/components/home/LeagueNewsSection.tsx) renders a `SectionShell` containing a `SectionHeader` and a `grid grid-cols-1 lg:grid-cols-3` row. Left (`lg:col-span-2`) holds the 2×2 article grid; the right column (1/3 width) currently holds only `LeaguesPanel`. The "blank space" the user refers to is the unused vertical area in that right column below the league buttons.
- **The panel stretches today:** [src/components/home/LeaguesPanel.tsx:21](../../../src/components/home/LeaguesPanel.tsx#L21) uses `h-full`, so the panel expands to match the taller left column, which is what produces the empty area at its bottom. We remove `h-full` so the panel sizes to its 6 buttons and the banner sits in the freed space. `LeaguesPanel` is used **only** by `LeagueNewsSection`, so this change is safe.
- **The asset:** `box-banner.jpg` is a **300×300 square** JPEG currently in the repo root. It must live under `public/images/` because [next.config.ts:28-35](../../../next.config.ts#L28-L35) only allows local `next/image` sources matching `/api/media/file/**` or `/images/**`. No config change is needed once the file is at `public/images/box-banner.jpg`.
- **Playlist URL (hardcoded for now):** `https://www.youtube.com/playlist?list=PL3AfsMqHuUG2ribU3zGm6xQ9G5FSPiDuF`
- **External-link convention** (from `AuthorCard.tsx`): plain `<a href=... target="_blank" rel="noopener noreferrer">`. Do NOT use `next/link` for the external playlist.
- **Card styling convention:** white surfaces use `rounded-xl border border-border bg-card shadow-sm`; image hover-zoom uses a `group` wrapper plus `group-hover:scale-105 transition-transform duration-300` on the image (see `NewsGrid2x2.tsx`).
- **i18n pattern:** Home components do not call `useTranslations`; parents pass already-translated strings (e.g. `LeagueNewsSection` receives `title`) or the component switches on `locale` internally (e.g. `LeaguesPanel.pickName`). We use the in-component locale map so no `messages/*.json` edits and no prop threading through `page.tsx` are required.
- **Test commands:** targeted run `pnpm test:run src/components/home/__tests__/<file>` ; full home suite `pnpm test:run src/components/home`. Vitest config: jsdom env, globals on, alias `@` → `src`, `next/image` renders a plain `<img>` in tests (no mock needed — see `LeaguesPanel.test.tsx`).

## File Structure

- **Create:** `src/components/home/LeaguePlaylistBanner.tsx` — the banner component (single responsibility: render the clickable promo image).
- **Create:** `src/components/home/__tests__/LeaguePlaylistBanner.test.tsx` — unit tests for the banner.
- **Create:** `public/images/box-banner.jpg` — the banner asset (copied from repo root).
- **Modify:** `src/components/home/LeagueNewsSection.tsx` — stack the banner under the panel in the right column.
- **Modify:** `src/components/home/LeaguesPanel.tsx:21` — drop `h-full` so the panel no longer stretches.
- **Delete (cleanup):** `box-banner.jpg` from repo root after copying.

---

### Task 1: Place the banner asset under public/images

**Files:**
- Create: `public/images/box-banner.jpg` (copied from repo root `box-banner.jpg`)
- Delete: `box-banner.jpg` (repo root)

- [ ] **Step 1: Copy the asset into the served public folder**

Run (PowerShell):
```powershell
Copy-Item "box-banner.jpg" "public/images/box-banner.jpg"
```

- [ ] **Step 2: Verify it copied and is the expected 300×300 JPEG**

Run:
```powershell
node -e "require('sharp')('public/images/box-banner.jpg').metadata().then(m=>console.log(m.width+'x'+m.height, m.format))"
```
Expected output: `300x300 jpeg`

- [ ] **Step 3: Remove the stray root copy**

Run (PowerShell):
```powershell
Remove-Item "box-banner.jpg"
```

- [ ] **Step 4: Commit the asset**

```bash
git add public/images/box-banner.jpg
git commit -m "chore(home): add box-banner.jpg playlist banner asset"
```

---

### Task 2: Create the LeaguePlaylistBanner component (TDD)

**Files:**
- Test: `src/components/home/__tests__/LeaguePlaylistBanner.test.tsx`
- Create: `src/components/home/LeaguePlaylistBanner.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/home/__tests__/LeaguePlaylistBanner.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaguePlaylistBanner } from "@/components/home/LeaguePlaylistBanner";

const PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PL3AfsMqHuUG2ribU3zGm6xQ9G5FSPiDuF";

describe("LeaguePlaylistBanner", () => {
  it("links to the YouTube playlist and opens in a new tab safely", () => {
    render(<LeaguePlaylistBanner locale="en" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", PLAYLIST_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the banner image from /images/box-banner.jpg", () => {
    render(<LeaguePlaylistBanner locale="en" />);
    const img = screen.getByRole("img");
    // next/image rewrites src into an optimizer URL; the original path is encoded inside it.
    expect(decodeURIComponent(img.getAttribute("src") ?? "")).toContain(
      "/images/box-banner.jpg",
    );
  });

  it("uses a localized accessible label (English)", () => {
    render(<LeaguePlaylistBanner locale="en" />);
    expect(
      screen.getByRole("link", { name: /Featured playlist on YouTube/i }),
    ).toBeInTheDocument();
  });

  it("uses the Arabic label when locale=ar", () => {
    render(<LeaguePlaylistBanner locale="ar" />);
    expect(
      screen.getByRole("link", { name: /قائمة تشغيل/ }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm test:run src/components/home/__tests__/LeaguePlaylistBanner.test.tsx
```
Expected: FAIL — `Failed to resolve import "@/components/home/LeaguePlaylistBanner"` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/home/LeaguePlaylistBanner.tsx`:

```tsx
"use client";

import Image from "next/image";

const PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PL3AfsMqHuUG2ribU3zGm6xQ9G5FSPiDuF";
const BANNER_SRC = "/images/box-banner.jpg";

const LABELS: Record<string, string> = {
  en: "Featured playlist on YouTube",
  ar: "قائمة تشغيل مميزة على يوتيوب",
  fr: "Playlist en vedette sur YouTube",
};

type Props = {
  locale: string;
};

export function LeaguePlaylistBanner({ locale }: Props) {
  const label = LABELS[locale] ?? LABELS.en;

  return (
    <a
      href={PLAYLIST_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="group block overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/30"
    >
      <Image
        src={BANNER_SRC}
        alt={label}
        width={300}
        height={300}
        sizes="(max-width: 1024px) 100vw, 33vw"
        className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </a>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
pnpm test:run src/components/home/__tests__/LeaguePlaylistBanner.test.tsx
```
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/LeaguePlaylistBanner.tsx src/components/home/__tests__/LeaguePlaylistBanner.test.tsx
git commit -m "feat(home): add LeaguePlaylistBanner component linking to YouTube playlist"
```

---

### Task 3: Wire the banner into the right column of LeagueNewsSection

**Files:**
- Modify: `src/components/home/LeagueNewsSection.tsx:24-35`
- Modify: `src/components/home/LeaguesPanel.tsx:21`

- [ ] **Step 1: Stop the leagues panel from stretching**

In `src/components/home/LeaguesPanel.tsx`, change the root `<div>` className on line 21.

Replace:
```tsx
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto rounded-xl border border-border bg-background p-2">
```
With:
```tsx
    <div className="flex flex-col gap-1.5 overflow-y-auto rounded-xl border border-border bg-background p-2">
```
(Only `h-full ` is removed — everything else is unchanged.)

- [ ] **Step 2: Import the banner and stack it under the panel**

In `src/components/home/LeagueNewsSection.tsx`, add the import after the existing `LeaguesPanel` import (line 4):

```tsx
import { LeaguesPanel } from "./LeaguesPanel";
import { LeaguePlaylistBanner } from "./LeaguePlaylistBanner";
```

Then replace the right-column `<div>` block (currently lines 28-35):

```tsx
        <div>
          <LeaguesPanel
            leagues={LEAGUES}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
```

With:

```tsx
        <div className="flex flex-col gap-3">
          <LeaguesPanel
            leagues={LEAGUES}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
          <LeaguePlaylistBanner locale={locale} />
        </div>
```

- [ ] **Step 3: Run the full home test suite to confirm no regressions**

Run:
```bash
pnpm test:run src/components/home
```
Expected: PASS — including the existing `LeagueNewsSection`, `LeaguesPanel`, and `NewsGrid2x2` suites. The banner adds one `<a>` and one `<img>` whose accessible name ("Featured playlist on YouTube") does not collide with any article link or league button, so the existing `getByRole("button"...)`, `getByRole("article")`, and heading assertions remain valid.

- [ ] **Step 4: Type-check / lint the changed files**

Run:
```bash
pnpm lint
```
Expected: no new errors in `LeagueNewsSection.tsx`, `LeaguesPanel.tsx`, or `LeaguePlaylistBanner.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/LeagueNewsSection.tsx src/components/home/LeaguesPanel.tsx
git commit -m "feat(home): place playlist banner under leagues selector in Latest News section"
```

---

### Task 4: Visual verification in the running app

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run:
```bash
pnpm dev
```
Expected: server starts on `http://localhost:3000` (or the next free port).

- [ ] **Step 2: Inspect the homepage section**

Open `http://localhost:3000/en` and scroll to the "News by League" section. Verify:
- The leagues selector no longer stretches with a blank gap; the square banner sits directly below it in the right column.
- The banner shows `box-banner.jpg`, has rounded corners + border + subtle shadow consistent with other cards, and zooms slightly on hover.
- Clicking the banner opens the YouTube playlist `https://www.youtube.com/playlist?list=PL3AfsMqHuUG2ribU3zGm6xQ9G5FSPiDuF` in a new tab.
- Switching leagues still updates the article grid (banner is unaffected).

- [ ] **Step 3: Check responsive / RTL behavior**

Open `http://localhost:3000/ar`. Verify the banner still renders full-width below the panel in the stacked mobile layout (narrow the window) and that the layout reads correctly right-to-left.

- [ ] **Step 4: Production build sanity check**

Run:
```bash
pnpm build
```
Expected: build completes without errors related to the new component or the `/images/box-banner.jpg` image source.

> Note: if `pnpm build` fails for pre-existing reasons unrelated to these files (e.g. external API calls at build time — see prior homepage work), capture the error and confirm it does not reference `LeaguePlaylistBanner`, `box-banner.jpg`, or `LeagueNewsSection`. Do not claim build success if it errors; report the actual output.

- [ ] **Step 5: Stop the dev server**

Stop the `pnpm dev` process (Ctrl+C in its terminal).

---

## Self-Review

**Spec coverage:**
- "Banner in the blank space under the leagues selector" → Task 3 stacks the banner in the right column below `LeaguesPanel` and removes the panel's `h-full` stretch that created the gap. ✅
- "Use box-banner.jpg (size already fits)" → Task 1 places the 300×300 asset; Task 2 renders it. ✅
- "Clickable → redirects to the YouTube playlist" → Task 2 wires the exact playlist URL via `target="_blank" rel="noopener noreferrer"`. ✅
- "Stylish, its own section just like the rest of the website" → banner is a `rounded-xl border bg-card shadow-sm` card with hover-zoom matching site card conventions. ✅
- "We will change the banner and link later" → URL and `BANNER_SRC` are single-source module constants, trivial to swap. ✅

**Placement assumption (stated explicitly):** The banner is placed *inside* `LeagueNewsSection`'s right column, under the leagues panel — not as a separate full-width section. This matches (a) the user describing "blank space under the leagues selector" and (b) the asset being a 300×300 **square**, which fits the ~1/3-width column rather than a full-width strip. If the intent was instead a full-width banner below the whole section, only Task 3 changes (render `<LeaguePlaylistBanner>` as its own `SectionShell` sibling after `LeagueNewsSection` in `page.tsx`); Tasks 1, 2, and 4 are unaffected.

**Placeholder scan:** No TODO/TBD/"handle edge cases" placeholders. Every code step shows complete code.

**Type consistency:** `LeaguePlaylistBanner` is exported as a named export `LeaguePlaylistBanner` with props `{ locale: string }`, imported and used identically in Task 3 and in the test. Constants `PLAYLIST_URL` / `BANNER_SRC` / `LABELS` are referenced consistently. No undefined symbols.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-03-latest-news-playlist-banner.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
