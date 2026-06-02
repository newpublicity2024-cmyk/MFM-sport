# MFM Sport Logo + Light Mode Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the circular red MFM Sport brand badge ([mfm-sport-logo.PNG](mfm-sport-logo.PNG)) as the canonical visual identity across the site (header, footer, browser tab icon, mobile home-screen icon) AND flip the default theme from dark to light so first-time visitors land on the new light surface.

**Architecture:** Two layers landed sequentially. (1) **Logo asset + component** — relocate the source PNG into `public/images/`, build one reusable `<BrandLogo>` Server Component that wraps Next `<Image>` with locale-aware `alt` text and size variants (`sm`/`md`/`lg`), then swap the two existing inline `<span>MFM</span><span>Sport</span>` wordmarks (Header, Footer) for `<BrandLogo>`. Also regenerate the App-Router favicon (`src/app/icon.png` 32×32) and Apple touch icon (`src/app/apple-icon.png` 180×180) from the same source via `sharp` so all surfaces use the same brand mark. (2) **Default theme flip** — single-line change in `src/app/(frontend)/layout.tsx`: `defaultTheme="dark"` → `defaultTheme="light"`. The token restructure (`:root` = light, `.dark` = dark) and the user toggle were already shipped in the prior light-mode plan ([docs/superpowers/plans/2026-05-11-light-mode.md](docs/superpowers/plans/2026-05-11-light-mode.md)); this plan only inverts the boot default. Returning users with a stored preference are unaffected (next-themes reads localStorage first).

**Tech Stack:** Next.js 16.2.4 / `next/image` (already in use) / `sharp` ^0.34.2 (already a dep — used for favicon regen) / `next-themes` ^0.4.6 (already wired) / Tailwind 3.4 / IBM Plex Sans + Arabic.

**Discovered state (verified during planning):**

- The brand asset lives at the repo root: [mfm-sport-logo.PNG](mfm-sport-logo.PNG) — 21,237 bytes, a circular red badge with white "MFM" wordmark, a darker red lower panel containing black "SPORT.MA" text, and a small black-and-white football glyph beside ".MA". Because the badge has its own opaque red background, it reads correctly on BOTH light and dark surfaces — no theme variant needed.
- The PNG is at the repo root (not in `/public/`) so it is currently NOT served by Next. It must be moved into `public/images/` to become a static asset under `/images/mfm-sport-logo.png`. Next's `next.config.ts` already allows `/images/**` via `localPatterns` (see [next.config.ts:33](next.config.ts#L33)) — no config change needed.
- The Header currently renders an inline text wordmark, NOT an image: [src/components/layout/Header.tsx:17-20](src/components/layout/Header.tsx#L17). Earlier commits (`667f45a feat(layout): swap text wordmark for real SVG logo in header`, then `4304ddf fix(layout): inline social SVGs, widen logo viewBox, allow /images/ in localPatterns`) used `/images/logo.svg`, but commit `5da96c5 fix(theme,db): inline header wordmark for theme contrast` reverted to inline text because the placeholder SVG had a hard-coded `#F5F5F5` fill that broke in light mode. The actual brand PNG sidesteps this entirely (self-contained red badge).
- The Footer renders the same inline wordmark pattern: [src/components/layout/Footer.tsx:62-64](src/components/layout/Footer.tsx#L62).
- The placeholder SVG at [public/images/logo.svg](public/images/logo.svg) is now dead weight — only referenced by the prior Header/Footer commits, and the commits referencing it have been reverted. Safe to delete.
- App-Router favicons live at [src/app/icon.png](src/app/icon.png) (32×32, an "M" glyph) and [src/app/apple-icon.png](src/app/apple-icon.png) (180×180, an "M" on red rounded square). Both must be regenerated from the source PNG so the browser tab, bookmark, and iOS home-screen icon match the new brand. Next App Router serves these automatically by filename — no metadata wiring needed.
- `sharp` 0.34.2 is already a runtime dep (used by Payload for media). We'll use it through a one-shot tsx script (`scripts/regen-favicons.ts`) — no new install.
- The OG image generator at [src/app/api/og/route.tsx](src/app/api/og/route.tsx) still renders the text wordmark on a dark gradient. **Intentionally out of scope** — it has a separate `ImageResponse` rendering pipeline, requires the logo to be inlined as a base64 data URL (edge runtime can't read from disk), and the dark OG card is fine for now. Documented in "Out of Scope".
- `defaultTheme="dark"` is set at [src/app/(frontend)/layout.tsx:39](src/app/(frontend)/layout.tsx#L39). The CSS tokens in [src/app/(frontend)/styles.css](src/app/(frontend)/styles.css) already have `:root` = light, `.dark` = dark (committed by the prior light-mode plan), so flipping the default to `light` just makes the existing light palette the boot state.
- The Header test at [src/components/layout/__tests__/Header.test.tsx:61-65](src/components/layout/__tests__/Header.test.tsx#L61) currently asserts `screen.getByText("MFM")` and `screen.getByText(/Sport/)`. After the swap to `<BrandLogo>`, those text nodes vanish — the test must be updated to assert the `<img>` by `alt` text.
- No Footer test exists today.
- Branch state: currently on `feat/light-mode` with 18 commits ahead of `main` (most recent fixes from the homepage matches panel + videos sections). This plan adds the logo + default-flip on top of the already-merged token restructure.

---

## File Structure

**New files:**
- `public/images/mfm-sport-logo.png` — relocated source asset (moved from repo root, lowercased)
- `src/components/layout/BrandLogo.tsx` — reusable Server Component rendering the brand mark via `next/image`. One responsibility: render the logo with consistent sizing, alt text, and priority loading where appropriate.
- `src/components/layout/__tests__/BrandLogo.test.tsx` — unit coverage for the variant sizing and alt-text contract.
- `scripts/regen-favicons.ts` — one-shot tsx script that reads `public/images/mfm-sport-logo.png` and writes `src/app/icon.png` (32×32) and `src/app/apple-icon.png` (180×180) via sharp.

**Modified files:**
- `mfm-sport-logo.PNG` — deleted from repo root (moved to `public/images/`)
- `public/images/logo.svg` — deleted (dead placeholder, no live references)
- `src/components/layout/Header.tsx` — swap inline `<span>MFM</span><span>Sport</span>` for `<BrandLogo size="sm" priority />`
- `src/components/layout/Footer.tsx` — swap inline wordmark for `<BrandLogo size="md" />`
- `src/components/layout/__tests__/Header.test.tsx` — assert image by `alt="MFM Sport"` instead of text
- `src/app/icon.png` — regenerated from source PNG (32×32)
- `src/app/apple-icon.png` — regenerated from source PNG (180×180)
- `src/app/(frontend)/layout.tsx` — `defaultTheme="dark"` → `defaultTheme="light"`
- `package.json` — add `"regen:favicons": "tsx scripts/regen-favicons.ts"` script

**Untouched (intentional):**
- `src/app/api/og/route.tsx` — out of scope (different rendering pipeline; documented below)
- `src/components/home/HeroSection.tsx` and `src/components/articles/ArticleCard.tsx` — they contain the literal text "MFM Sport" as a content attribution byline (author/credit), NOT as branding. Stays as text.
- Email branding in `src/lib/resend.ts` — out of scope (transactional template, separate review pass)
- The Payload admin shell — has its own brand and isn't user-facing

---

### Task 1: Relocate the brand asset into `public/images/`

**Files:**
- Create: `public/images/mfm-sport-logo.png` (from existing root PNG)
- Delete: `mfm-sport-logo.PNG` (root) and `public/images/logo.svg` (dead placeholder)

- [ ] **Step 1: Verify the source exists at the repo root**

Run: `ls mfm-sport-logo.PNG`
Expected: file is listed (21,237 bytes).

If it's missing, abort — the brand asset must be present before the rest of the plan runs.

- [ ] **Step 2: Move (rename) the PNG into `public/images/` with a lowercase, web-safe name**

PowerShell:

```powershell
Move-Item -Path "mfm-sport-logo.PNG" -Destination "public/images/mfm-sport-logo.png"
```

(Single command — Windows is case-insensitive at the FS layer, but the destination filename should be lowercase so URL paths are predictable on case-sensitive deploy hosts.)

Verify:

```powershell
Get-Item public/images/mfm-sport-logo.png | Select-Object Name, Length
```

Expected: `mfm-sport-logo.png 21237`.

- [ ] **Step 3: Delete the dead placeholder SVG**

Run: `Remove-Item public/images/logo.svg`

> **Why delete:** the file is only referenced by reverted commits and has a hard-coded `#F5F5F5` fill that broke in light mode (the reason it was replaced by inline text in commit `5da96c5`). Removing it prevents future contributors from re-mounting a stale asset.

- [ ] **Step 4: Confirm the new asset is reachable through dev server**

Run `pnpm dev` (background, wait for `:3000` to bind). Visit `http://localhost:3000/images/mfm-sport-logo.png` in a browser. Expected: the circular red MFM Sport badge renders. If 404, re-check the move in Step 2.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add public/images/mfm-sport-logo.png mfm-sport-logo.PNG public/images/logo.svg
git commit -m "chore(brand): move source logo PNG into public/images and drop stale placeholder svg"
```

(Git records the deletion of `mfm-sport-logo.PNG` and `public/images/logo.svg` alongside the new file.)

---

### Task 2: Build the `<BrandLogo>` Server Component (TDD)

**Files:**
- Create: `src/components/layout/BrandLogo.tsx`
- Create: `src/components/layout/__tests__/BrandLogo.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create [src/components/layout/__tests__/BrandLogo.test.tsx](src/components/layout/__tests__/BrandLogo.test.tsx):

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { BrandLogo } from "../BrandLogo";

// Mock next/image to render a plain <img> with width/height attrs
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
    priority,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
    priority?: boolean;
  }) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      data-priority={priority ? "true" : "false"}
    />
  ),
}));

describe("BrandLogo", () => {
  it("renders the brand mark with an accessible alt text", () => {
    render(<BrandLogo />);
    const img = screen.getByAltText("MFM Sport");
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("/images/mfm-sport-logo.png");
  });

  it("defaults to the md size (40x40)", () => {
    render(<BrandLogo />);
    const img = screen.getByAltText("MFM Sport");
    expect(img.getAttribute("width")).toBe("40");
    expect(img.getAttribute("height")).toBe("40");
  });

  it("renders the sm variant at 32x32", () => {
    render(<BrandLogo size="sm" />);
    const img = screen.getByAltText("MFM Sport");
    expect(img.getAttribute("width")).toBe("32");
    expect(img.getAttribute("height")).toBe("32");
  });

  it("renders the lg variant at 56x56", () => {
    render(<BrandLogo size="lg" />);
    const img = screen.getByAltText("MFM Sport");
    expect(img.getAttribute("width")).toBe("56");
    expect(img.getAttribute("height")).toBe("56");
  });

  it("passes the priority flag through to next/image", () => {
    render(<BrandLogo priority />);
    const img = screen.getByAltText("MFM Sport");
    expect(img.getAttribute("data-priority")).toBe("true");
  });

  it("merges an extra className with the size-based classes", () => {
    render(<BrandLogo className="ml-2" />);
    const img = screen.getByAltText("MFM Sport");
    expect(img.className).toContain("ml-2");
  });
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run: `pnpm test:run src/components/layout/__tests__/BrandLogo.test.tsx 2>&1 | tail -20`
Expected: failure — `Failed to resolve import "../BrandLogo"`.

- [ ] **Step 3: Implement `BrandLogo`**

Create [src/components/layout/BrandLogo.tsx](src/components/layout/BrandLogo.tsx):

```tsx
import Image from "next/image";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

type Props = {
  size?: Size;
  priority?: boolean;
  className?: string;
};

const DIMENSIONS: Record<Size, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

export function BrandLogo({ size = "md", priority = false, className }: Props) {
  const dim = DIMENSIONS[size];
  return (
    <Image
      src="/images/mfm-sport-logo.png"
      alt="MFM Sport"
      width={dim}
      height={dim}
      priority={priority}
      className={cn("block h-auto w-auto select-none", className)}
    />
  );
}
```

> **Why a Server Component:** the logo is static, theme-agnostic (the red badge reads on both themes), and never needs client state. A Server Component avoids shipping any JS for the logo. The `priority` prop opts the Header instance into above-the-fold LCP preloading; the Footer instance leaves it false.
>
> **Why `next/image` not raw `<img>`:** automatic responsive `srcset`, lazy loading by default (overridden via `priority`), and width/height baked in to prevent CLS. Already used everywhere else in the project (e.g., [src/components/articles/ArticleCard.tsx](src/components/articles/ArticleCard.tsx)) — keeps the pattern consistent.
>
> **Why fixed `width`/`height` and `h-auto w-auto`:** `next/image` requires explicit dimensions for layout stability, and `h-auto w-auto` lets the parent flex container size it without overriding the intrinsic aspect ratio (the source PNG is square, so the rendered box is square at the declared px).

- [ ] **Step 4: Re-run the tests and confirm they pass**

Run: `pnpm test:run src/components/layout/__tests__/BrandLogo.test.tsx 2>&1 | tail -15`
Expected: 6/6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/BrandLogo.tsx src/components/layout/__tests__/BrandLogo.test.tsx
git commit -m "feat(layout): add BrandLogo server component with sm/md/lg size variants"
```

---

### Task 3: Mount `<BrandLogo>` in the Header and update the Header test

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/__tests__/Header.test.tsx`

- [ ] **Step 1: Update the Header to use `<BrandLogo>`**

Open [src/components/layout/Header.tsx](src/components/layout/Header.tsx). Add the import next to the other layout imports:

```tsx
import { BrandLogo } from "./BrandLogo";
```

Replace the `<Link>` body (currently lines 16-21):

```tsx
        <Link href={`/${locale}`} className="flex items-center" aria-label="MFM Sport">
          <span className="text-xl font-bold leading-none">
            <span className="text-primary">MFM</span>
            <span className="text-foreground"> Sport</span>
          </span>
        </Link>
```

with:

```tsx
        <Link href={`/${locale}`} className="flex items-center" aria-label="MFM Sport">
          <BrandLogo size="sm" priority />
        </Link>
```

> **Why `size="sm"` (32px) here:** the header is `h-14` (56px) — a 32px logo leaves ~12px breathing room top/bottom, matching the density of the existing nav links and switchers. `priority` flags it for LCP preloading since it sits above the fold.

- [ ] **Step 2: Update the Header test to assert the image, not the text**

Open [src/components/layout/__tests__/Header.test.tsx](src/components/layout/__tests__/Header.test.tsx). Add this mock alongside the existing mocks (after the `MobileNav` mock, before the `ThemeSwitcher` mock):

```tsx
// Mock BrandLogo to render a plain img the test can find by alt
vi.mock("../BrandLogo", () => ({
  BrandLogo: () => <img src="/images/mfm-sport-logo.png" alt="MFM Sport" />,
}));
```

Replace the existing first `it` block (currently lines 61-65):

```tsx
  it("renders the MFM Sport logo", () => {
    render(<Header locale="ar" />);
    expect(screen.getByText("MFM")).toBeInTheDocument();
    expect(screen.getByText(/Sport/)).toBeInTheDocument();
  });
```

with:

```tsx
  it("renders the MFM Sport logo", () => {
    render(<Header locale="ar" />);
    const logo = screen.getByAltText("MFM Sport");
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute("src")).toBe("/images/mfm-sport-logo.png");
  });
```

> **Why mock `BrandLogo`:** the real component imports `next/image`, which in the unit-test env (jsdom) without the next-image-mock plugin would emit extra wrapper markup. Mocking keeps the Header test focused on Header concerns. The real `BrandLogo` already has its own dedicated test from Task 2.

- [ ] **Step 3: Run the Header test alone**

Run: `pnpm test:run src/components/layout/__tests__/Header.test.tsx 2>&1 | tail -15`
Expected: 2/2 passing.

- [ ] **Step 4: Smoke-test in the browser**

Run `pnpm dev` (background, wait for ready). Visit `http://localhost:3000/ar`. Expected: the circular red MFM badge replaces the inline "MFM Sport" wordmark in the header. Click it — should navigate to `/ar`. The logo sits to the LEFT in `/ar` because `<html dir="rtl">` flips the flex order; on `/fr` and `/en` it sits where Latin layouts expect.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/__tests__/Header.test.tsx
git commit -m "feat(layout): swap header text wordmark for BrandLogo image"
```

---

### Task 4: Mount `<BrandLogo>` in the Footer

**Files:**
- Modify: `src/components/layout/Footer.tsx`

- [ ] **Step 1: Update the Footer to use `<BrandLogo>`**

Open [src/components/layout/Footer.tsx](src/components/layout/Footer.tsx). Add the import next to the existing layout-adjacent imports (top of file):

```tsx
import { BrandLogo } from "./BrandLogo";
```

Replace the brand block (currently lines 60-65):

```tsx
          {/* Brand */}
          <div>
            <Link href={`/${locale}`} className="inline-block">
              <span className="text-xl font-bold text-primary">MFM</span>
              <span className="text-xl font-bold text-foreground"> Sport</span>
            </Link>
          </div>
```

with:

```tsx
          {/* Brand */}
          <div>
            <Link
              href={`/${locale}`}
              className="inline-block"
              aria-label="MFM Sport"
            >
              <BrandLogo size="md" />
            </Link>
          </div>
```

> **Why `size="md"` (40px) here:** the footer has more breathing room than the header and serves as the secondary brand placement — slightly larger reads as "this is who we are" without overpowering the surrounding link/social rows. `priority` is intentionally false (below the fold).
>
> **Why add `aria-label`:** the previous wordmark made the link self-descriptive via its visible text. With only an image inside, the link needs an `aria-label` (the `<img alt>` is on the inner element, not the link itself — screen readers reading "link" without context is poor UX).

- [ ] **Step 2: Smoke-test in the browser**

Run `pnpm dev` (background, wait). Visit `http://localhost:3000/fr`. Scroll to the footer. Expected: the circular red MFM badge replaces the inline wordmark in the brand column. The three other footer columns (links, social, newsletter) sit beside it unchanged.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Footer.tsx
git commit -m "feat(layout): swap footer text wordmark for BrandLogo image"
```

---

### Task 5: Regenerate `icon.png` and `apple-icon.png` from the source PNG

**Files:**
- Create: `scripts/regen-favicons.ts`
- Modify: `src/app/icon.png` (binary regen)
- Modify: `src/app/apple-icon.png` (binary regen)
- Modify: `package.json` (add `regen:favicons` script)

- [ ] **Step 1: Create the regen script**

Create [scripts/regen-favicons.ts](scripts/regen-favicons.ts):

```ts
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const SOURCE = path.join(repoRoot, "public/images/mfm-sport-logo.png");
const FAVICON_OUT = path.join(repoRoot, "src/app/icon.png");
const APPLE_OUT = path.join(repoRoot, "src/app/apple-icon.png");

async function main() {
  await sharp(SOURCE)
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(FAVICON_OUT);
  console.log(`wrote ${FAVICON_OUT} (32x32)`);

  await sharp(SOURCE)
    .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(APPLE_OUT);
  console.log(`wrote ${APPLE_OUT} (180x180)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

> **Why `fit: "contain"` with transparent background:** the source PNG is the circular badge with (presumably) transparent corners. `contain` preserves the full badge inside the square output box without cropping the edges of the circle. Transparent corners let the browser render the badge against any UI surface (light tab bar, dark menu, etc.) without a clashing background fill.
>
> **Why 32 and 180:** Next App Router's icon convention reads `icon.{png,svg,...}` at any resolution but 32×32 is the conventional favicon size that Chrome and Edge use for the address-bar / tab. `apple-icon.png` is documented at 180×180 — the iOS home-screen tile size.

- [ ] **Step 2: Add a convenience script to `package.json`**

Open [package.json](package.json). In the `"scripts"` object, add this line after `"seed:preview:reset"`:

```json
    "regen:favicons": "tsx scripts/regen-favicons.ts",
```

The relevant slice of `scripts` should now read:

```json
    "seed": "tsx scripts/seed.ts",
    "seed:preview": "tsx scripts/seed-preview.ts",
    "seed:preview:reset": "tsx scripts/seed-preview.ts --reset",
    "regen:favicons": "tsx scripts/regen-favicons.ts"
```

(Mind the trailing comma on `seed:preview:reset` — the new line is the LAST script, so it has no comma.)

- [ ] **Step 3: Run the regen script**

Run: `pnpm regen:favicons`
Expected output:
```
wrote .../src/app/icon.png (32x32)
wrote .../src/app/apple-icon.png (180x180)
```

- [ ] **Step 4: Verify the outputs visually**

Open `src/app/icon.png` and `src/app/apple-icon.png` in any image viewer (or via `Read` if you're an agent — both render inline). Expected: the circular red MFM badge, scaled to 32×32 and 180×180 respectively, on a transparent background.

If either file still shows the old "M"-only icon, re-check Step 3 ran cleanly.

- [ ] **Step 5: Smoke-test the favicon in a real browser**

Run `pnpm dev` (background, wait). Open `http://localhost:3000/ar` in a fresh tab (or hard-refresh — favicons cache aggressively: Chrome `Ctrl+Shift+R`, or DevTools → Application → Clear storage → Cookies and other site data → Clear). Expected: the browser tab now shows the circular red MFM badge in the favicon slot.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add scripts/regen-favicons.ts src/app/icon.png src/app/apple-icon.png package.json
git commit -m "feat(brand): regenerate icon.png and apple-icon.png from circular MFM logo"
```

---

### Task 6: Flip the default theme from dark to light

**Files:**
- Modify: `src/app/(frontend)/layout.tsx`

- [ ] **Step 1: Change the `defaultTheme` prop**

Open [src/app/(frontend)/layout.tsx](src/app/(frontend)/layout.tsx). On line 39, replace:

```tsx
          defaultTheme="dark"
```

with:

```tsx
          defaultTheme="light"
```

The full `<ThemeProvider>` block should now read:

```tsx
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
```

> **Why this is the only change needed:** the prior light-mode plan ([2026-05-11-light-mode.md](docs/superpowers/plans/2026-05-11-light-mode.md)) already restructured `styles.css` so `:root` carries light tokens and `.dark` carries dark, gated `prose-invert` behind `dark:`, and added the toggle. `defaultTheme` is the only thing pinning the boot state to dark.
>
> **Why returning users with a stored preference are unaffected:** `next-themes` reads `localStorage["theme"]` first; `defaultTheme` only applies when no key exists (fresh visitor or cleared storage). The previous `defaultTheme="dark"` value never gets persisted on its own — only an explicit user toggle writes to localStorage. Users who never touched the toggle ALSO had no stored value, so they DO see the change. That's the intent.
>
> **Why we keep `enableSystem`:** the toggle continues to offer Light / Dark / System. A user preferring the OS preference can still pick that; the default for first-time visitors with no preference picked is now Light.

- [ ] **Step 2: Smoke-test in a fresh-storage browser context**

Run `pnpm dev` (background, wait). Open `http://localhost:3000/ar` in an **incognito / private window** (so localStorage is empty). Expected:
- The page renders in LIGHT mode: white background, dark text, brand red primary, the new logo visible in the header.
- DevTools → Elements → `<html>` has NO `dark` class.

Open the theme switcher (sun/moon icon in the header) → pick "Dark". Page flips to dark. Reload. Expected: stays dark (preference now persisted).

Close the incognito window, open another fresh incognito tab to confirm: visits start in light again.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(frontend\)/layout.tsx
git commit -m "feat(theme): flip defaultTheme from dark to light for first-time visitors"
```

---

### Task 7: Visual QA pass — logo + light-default across key surfaces

**Files:** None modified unless issues are found.

- [ ] **Step 1: Capture screenshots in both themes for key surfaces**

Run `pnpm dev` (background, wait). Use Playwright MCP (`mcp__plugin_playwright_playwright__*`). For each URL:
1. Navigate
2. Run `localStorage.clear()` via `browser_evaluate` then reload — confirms the new light default
3. Screenshot full page

URLs (locales `ar` for RTL primary, `fr` for Latin sanity):

- `http://localhost:3000/ar` → `qa-logo-light-ar-home.jpeg`
- `http://localhost:3000/fr` → `qa-logo-light-fr-home.jpeg`
- `http://localhost:3000/ar/articles/demo-botola-matchday-review` → `qa-logo-light-ar-article.jpeg` (use whichever demo slug is current — the seeded list in [scripts/seed-preview.ts](scripts/seed-preview.ts) is authoritative)
- `http://localhost:3000/ar/competition` → `qa-logo-light-ar-competitions.jpeg`
- `http://localhost:3000/fr/club` → `qa-logo-light-fr-clubs.jpeg`
- `http://localhost:3000/ar/this-does-not-exist` → `qa-logo-light-ar-404.jpeg`

Then switch to dark via the header toggle, reload, and capture two comparison frames:

- `http://localhost:3000/ar` → `qa-logo-dark-ar-home.jpeg`
- `http://localhost:3000/fr` → `qa-logo-dark-fr-home.jpeg`

Save under the repo root (matches the existing `qa-*.jpeg` pattern in the workspace).

- [ ] **Step 2: Audit each light-mode screenshot**

Walk through each screenshot and verify:
- Header: circular MFM badge renders crisp, sized appropriately (~32px tall), centred vertically in the `h-14` header strip
- Footer: circular MFM badge renders at `~40px`, aligned with the link/social columns
- Background is light (#fcfcfc-ish), text is dark, brand red links/buttons read clearly
- The HeroSection scrim still darkens the bottom of the hero image (uses `--scrim`, always dark)
- The 404 page primary button (red on white) is high-contrast
- The mobile view (resize to 375×667 in DevTools or via Playwright `browser_resize`) renders the same logo without distortion — check `/ar` mobile especially
- The browser tab favicon shows the circular red MFM badge (not the old "M")

Walk through the dark screenshots and verify:
- The same logo reads on the dark surface (the red badge has its own opaque background — it should sit on `#0E0E10` cleanly, with the red ring against near-black being high-contrast)
- No regression from the prior dark-mode UX

Write any findings to `qa-logo-issues.md` at the repo root with surface + selector + suggested fix per issue.

- [ ] **Step 3: Fix issues found (skip if none)**

For each issue:
- Open the affected component
- Adjust (e.g., bump the header `size` to `md` if `sm` looks too small in production density, or add `dark:opacity-95` if the badge appears too saturated against pure black — neither change is expected but listed for completeness)
- Re-screenshot, mark resolved

- [ ] **Step 4: Commit any fixes (skip if none)**

```bash
git add -A
git commit -m "fix(brand): polish pass on logo placement and light-default contrast"
```

If no fixes were needed: skip and proceed to Task 8.

---

### Task 8: Pre-merge verification

**Files:** None modified — verification only.

- [ ] **Step 1: Lint**

Run: `pnpm lint 2>&1 | tail -15`
Expected: no new errors in files touched by this plan. Any pre-existing lint warnings unrelated to brand/logo work are out of scope.

- [ ] **Step 2: Tests**

Run: `pnpm test:run 2>&1 | tail -15`
Expected: all green. New count = baseline (per previous plan, ≥63) + 6 (BrandLogo) = ≥69 tests. The Header test still passes 2/2 with the updated assertion.

- [ ] **Step 3: Production build**

Run: `pnpm build 2>&1 | tail -30`
Expected: completes without error. Confirm in the build output that:
- `/images/mfm-sport-logo.png` appears in the static asset list (Next reports it under "First Load JS" or "Static Assets")
- `icon.png` (32×32) and `apple-icon.png` (180×180) are reported as App-Router metadata files

- [ ] **Step 4: Manual sanity check against the production build**

Run `pnpm start` (background, on `:3000`). Open `http://localhost:3000/ar` in an incognito window. Verify:
- First-paint is LIGHT (no flash of dark — next-themes' inline script writes the class before paint)
- Header shows the circular red MFM logo
- Footer shows the circular red MFM logo
- Browser tab favicon shows the circular red MFM logo
- Theme toggle works: Light → Dark → System → Light cycles cleanly without FOUC

Stop the prod server.

- [ ] **Step 5: Commit any fixes (skip if none)**

```bash
git add -A
git commit -m "fix: production build issues from logo + light-default plan pre-merge check"
```

---

## Out of Scope (do NOT implement in this plan)

- **OG image generator** ([src/app/api/og/route.tsx](src/app/api/og/route.tsx)) — still renders the text wordmark on a dark gradient. The edge runtime can't read from disk, so the logo would need to be inlined as a base64 data URL; the dark OG card is brand-acceptable for now. Separate concern.
- **Email branding** in [src/lib/resend.ts](src/lib/resend.ts) — text-only "MFM Sport" in subject lines and from-name. Adding the logo image to transactional emails is a separate template revision.
- **Translating the BrandLogo `alt` text** per locale — "MFM Sport" is a proper noun, identical in ar/fr/en. Keeping it untranslated is correct.
- **Replacing the inline text "MFM Sport" attributions** in [HeroSection.tsx](src/components/home/HeroSection.tsx#L39) and [ArticleCard.tsx](src/components/articles/ArticleCard.tsx#L38) — those are byline/credit text, NOT branding placements. Leaving them as text is intentional.
- **Adding a dark-theme variant of the logo** — the source PNG's opaque red badge reads on both backgrounds; a separate dark-theme asset would be over-engineering.
- **Removing the `defaultTheme` prop entirely (so System becomes the boot value)** — explicit `light` is what was asked for, and gives a predictable boot state regardless of OS preference.
- **Updating the Payload admin shell to use the new logo** — Payload manages its own brand UI; out of scope.

---

## Self-Review

**Spec coverage:**

| Requirement | Covered by |
|---|---|
| Implement the actual MFM Sport logo (PNG) in a coherent way | Tasks 1–5 (asset relocation, reusable BrandLogo, Header, Footer, favicons) |
| Logo works across both themes without a per-theme variant | Source PNG has its own opaque red background — verified in Task 7 dark screenshots |
| Logo replaces the inline text wordmark in the header | Task 3 |
| Logo replaces the inline text wordmark in the footer | Task 4 |
| Browser tab + iOS home-screen icon match the new brand | Task 5 (favicon regen) |
| Light mode becomes the default (not dark) | Task 6 |
| Existing toggle still works (user can opt into Dark/System) | Verified in Tasks 6 (smoke-test) + 8 (prod sanity) |
| Returning users with a stored preference are unaffected | Documented in Task 6 (next-themes reads localStorage first) |
| No regression to existing tests | Header test updated in Task 3; full suite gated by Task 8 |

All nine sub-requirements mapped. ✓

**Type consistency:**
- `BrandLogo` props: `size?: "sm" | "md" | "lg"`, `priority?: boolean`, `className?: string`. Used identically in Header (`size="sm" priority`) and Footer (`size="md"`).
- `DIMENSIONS` record is `Record<Size, number>` — exhaustively keyed by the `Size` union. Adding a future variant requires extending both the union and the record (TypeScript will catch a missing key).
- `next/image` props (`src`/`alt`/`width`/`height`/`priority`/`className`) match the official API.
- `next-themes` `defaultTheme` accepts `string` (any registered theme) — `"light"` is valid since the default themes list is `["light","dark","system"]`.

**Placeholder scan:** No "TBD", "implement later", "similar to Task N". Every step shows actual code or actual commands.

**Decomposition check:**
- Task 1 (asset move) is independent.
- Task 2 (BrandLogo component) depends on the asset being at `/images/mfm-sport-logo.png` for the smoke-test, but the component itself + tests don't need it to exist on disk (the test mocks `next/image`).
- Tasks 3 and 4 (Header, Footer) both depend on Task 2.
- Task 5 (favicons) depends on Task 1 (source must be in `public/images/`).
- Task 6 (default theme flip) is fully independent of the logo work and could ship separately. Bundled here because both are tagged in the same user request.
- Task 7 is verification of the combined result; Task 8 is the pre-merge gate.

**Risk audit:**
- **Highest risk:** the favicon regen step (Task 5) overwrites two binary files in `src/app/`. If the script fails midway, one icon could be stale. Mitigation: the script writes each file independently and logs success per file — partial failure is detectable, and the prior commits track the old binaries for revert.
- **Medium risk:** the source PNG's actual transparency state is assumed. If the PNG has a white square background instead of a transparent one, the favicon will render with a white square around the badge (still legible but less polished). Mitigation: Task 5 Step 4's visual verification catches this — if the favicon shows a white square, the script's `background: { r: 0, g: 0, b: 0, alpha: 0 }` can be swapped for a different background fill or the source can be alpha-stripped in a pre-step.
- **Low risk:** the default-theme flip (Task 6) is one line. The only failure mode is the prior light-mode plan having NOT shipped (so `:root` wouldn't have light tokens). Verified during planning: the prior tokens are present at [src/app/(frontend)/styles.css](src/app/(frontend)/styles.css).
- **No risk:** removing the dead `logo.svg` (Task 1 Step 3) — `grep` confirms zero live references in `src/`.

---

*Plan complete.*
