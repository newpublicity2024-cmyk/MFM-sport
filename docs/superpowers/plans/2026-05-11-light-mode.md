# Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully-functional light theme alongside the existing dark theme, with a user-facing toggle (System / Light / Dark) in the header. The dark theme remains the default to preserve the boss-approved aesthetic; light is opt-in.

**Architecture:** Three layers landed sequentially: (1) **Token restructure** — invert `styles.css` so `:root` carries light-mode tokens and a new `.dark` selector carries the existing dark tokens (which are then activated by `next-themes` adding/removing the `dark` class on `<html>`). Tailwind switches to `darkMode: 'class'` so any future `dark:` utility responds to the same class. (2) **Provider + toggle** — install `next-themes`, wrap the frontend layout in a client-component ThemeProvider, build a ThemeSwitcher that mirrors the existing LanguageSwitcher dropdown pattern using lucide Sun/Moon/Monitor icons, and mount it in the header. (3) **Existing override cleanup** — `prose-invert` is hard-coded on three article body surfaces and must become `dark:prose-invert` so the typography flips correctly per theme.

**Tech Stack:** `next-themes` ^0.4 (industry-standard Next.js theme provider) / Tailwind 3.4 (class-based darkMode) / Radix UI DropdownMenu (already in use) / `lucide-react` (already in use) / IBM Plex Sans + Arabic (theme-agnostic).

**Discovered state (verified during planning):**

- Tailwind config does NOT currently set `darkMode` — defaults to `'media'`. The few existing `dark:` utilities (`AdLabel.tsx:18`, `StickyMobileAd.tsx:25`) currently react to OS preference, inconsistent with the always-dark CSS-var tokens. After this plan, both will respect the manual `.dark` class.
- `styles.css` defines all tokens under `:root` only — no `.dark` selector, no `prefers-color-scheme` media query. The site is always dark regardless of OS preference.
- `next-themes` is NOT in `package.json` — fresh install needed.
- Three files hard-code `prose-invert` outside a dark conditional: [src/components/articles/ArticleBody.tsx:11](src/components/articles/ArticleBody.tsx#L11), [src/components/articles/InArticleAdInjector.tsx:35](src/components/articles/InArticleAdInjector.tsx#L35), [src/components/articles/InArticleAdInjector.tsx:39](src/components/articles/InArticleAdInjector.tsx#L39).
- `text-white` is hard-coded in [src/components/home/HeroSection.tsx:43](src/components/home/HeroSection.tsx#L43) for h2 and `:52` for time. These sit on top of a dark image + scrim gradient; they must remain white in BOTH themes since the scrim is always dark.
- `text-white` in [src/components/football/StandingsTable.tsx:38](src/components/football/StandingsTable.tsx#L38) is on coloured W/L/D badges — stays white in both themes.
- `bg-black/80` in [src/components/ui/sheet.tsx:24](src/components/ui/sheet.tsx#L24) is the modal overlay; black scrim over content is appropriate in both themes.
- `--scrim: 240 6% 3%` (added in commit `989288c`) is image-overlay only — stays dark in both themes.
- Brand red `--primary: 355 72% 49%` (#D92332) has acceptable contrast against both white (~5:1, AA-large) and the dark `#0E0E10` background. Stays unchanged across themes.
- Branch state: currently on `fix/runtime-errors` at `cc4e0e2` with 7 commits ahead of `main`. This plan adds a feature on top — recommended to merge `fix/runtime-errors` into `main` first, then branch off `main` for this work, or continue on `fix/runtime-errors` if not yet shipped.

---

## File Structure

**New files:**
- `src/components/theme/ThemeProvider.tsx` — client component wrapping next-themes' `ThemeProvider`. One responsibility: bridge server layout → client provider.
- `src/components/layout/ThemeSwitcher.tsx` — dropdown toggle with Sun/Moon/Monitor icons. One responsibility: read+write current theme via `useTheme()`.
- `src/components/layout/__tests__/ThemeSwitcher.test.tsx` — basic mount + click coverage.

**Modified files:**
- `package.json` + `pnpm-lock.yaml` — add `next-themes` dependency
- `tailwind.config.ts` — add `darkMode: 'class'`
- `src/app/(frontend)/styles.css` — restructure: `:root` becomes light tokens, new `.dark { ... }` block carries the previous dark tokens
- `src/app/(frontend)/layout.tsx` — wrap children in `<ThemeProvider>`
- `src/components/layout/Header.tsx` — mount `<ThemeSwitcher />` next to `<LanguageSwitcher />`
- `src/components/articles/ArticleBody.tsx` — `prose-invert` → `dark:prose-invert`
- `src/components/articles/InArticleAdInjector.tsx` — same, two instances

**Untouched (intentional):**
- All other components — they consume tokens through `bg-card`, `text-foreground`, etc., so swapping the underlying CSS vars at the `.dark` boundary automatically themes them.
- The Payload admin shell — Payload handles its own theming and isn't affected by next-themes on the frontend layout.

---

### Task 1: Install next-themes and switch Tailwind to class-based darkMode

**Files:**
- Modify: `package.json` (+ `pnpm-lock.yaml`)
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Install next-themes**

Run: `pnpm add next-themes`
Expected: `next-themes` appears under `dependencies` in `package.json` (version ^0.4.x at time of writing). `pnpm-lock.yaml` updates.

- [ ] **Step 2: Add darkMode: 'class' to Tailwind config**

Open [tailwind.config.ts](tailwind.config.ts). Insert `darkMode: "class",` as the first property inside the top-level `Config` object, before `content:`:

```ts
const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    // ... unchanged
```

> **Why this matters:** without `darkMode: "class"`, Tailwind's default is `'media'` (OS preference). The few `dark:` utilities in `AdLabel.tsx` and `StickyMobileAd.tsx` currently follow OS preference. After this change they follow the `.dark` class that next-themes manages, keeping the whole app on one source of truth.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml tailwind.config.ts
git commit -m "chore(theme): add next-themes dep and switch tailwind to class-based dark mode"
```

---

### Task 2: Restructure CSS tokens — light as default, dark under `.dark`

**Files:**
- Modify: `src/app/(frontend)/styles.css`

- [ ] **Step 1: Replace the entire `@layer base { :root { ... } }` block with the new structure**

Open [src/app/(frontend)/styles.css](src/app/(frontend)/styles.css). Replace lines 5-56 (the `@layer base { :root { ... } }` block — everything from `@layer base {` opening to its `}` closing) with:

```css
@layer base {
  :root {
    /* Backgrounds */
    --background: 0 0% 99%;            /* near-white */
    --foreground: 240 6% 10%;          /* near-black */

    --card: 0 0% 100%;                 /* pure white surface */
    --card-foreground: 240 6% 10%;

    --popover: 0 0% 100%;
    --popover-foreground: 240 6% 10%;

    /* Brand — unchanged across themes */
    --primary: 355 72% 49%;            /* #D92332 Moroccan red */
    --primary-foreground: 0 0% 100%;

    --secondary: 240 5% 96%;           /* light gray surface */
    --secondary-foreground: 240 6% 10%;

    --muted: 240 5% 96%;
    --muted-foreground: 240 4% 46%;    /* readable gray on white */

    --accent: 37 91% 55%;              /* #F5A623 amber */
    --accent-foreground: 0 0% 6%;

    --destructive: 0 84% 60%;          /* #EF4444 */
    --destructive-foreground: 0 0% 100%;

    /* Borders */
    --border: 240 6% 90%;              /* light gray (solid, not alpha) */
    --input: 240 6% 90%;
    --ring: 355 72% 49%;

    --radius: 0.5rem;

    /* Semantic — football-specific (theme-agnostic hues) */
    --win: 160 60% 45%;
    --loss: 0 84% 60%;
    --draw: 38 92% 50%;
    --live: 38 92% 50%;

    /* Scrim — image overlay; always dark regardless of theme */
    --scrim: 240 6% 3%;

    /* Sidebar (Payload admin / shadcn default) */
    --sidebar-background: 0 0% 99%;
    --sidebar-foreground: 240 6% 10%;
    --sidebar-primary: 355 72% 49%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 240 5% 96%;
    --sidebar-accent-foreground: 240 6% 10%;
    --sidebar-border: 240 6% 90%;
    --sidebar-ring: 355 72% 49%;
  }

  .dark {
    /* Backgrounds */
    --background: 240 6% 6%;           /* #0E0E10 near-black */
    --foreground: 0 0% 96%;            /* #F5F5F5 */

    --card: 240 5% 11%;                /* #1A1A1D surface */
    --card-foreground: 0 0% 96%;

    --popover: 240 5% 11%;
    --popover-foreground: 0 0% 96%;

    /* Brand — unchanged */
    --primary: 355 72% 49%;
    --primary-foreground: 0 0% 100%;

    --secondary: 240 6% 14%;           /* #222226 elevated */
    --secondary-foreground: 0 0% 96%;

    --muted: 240 6% 14%;
    --muted-foreground: 220 9% 46%;

    --accent: 37 91% 55%;
    --accent-foreground: 0 0% 6%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    /* Borders */
    --border: 0 0% 100% / 0.08;
    --input: 0 0% 100% / 0.08;
    --ring: 355 72% 49%;

    /* Sidebar */
    --sidebar-background: 240 6% 6%;
    --sidebar-foreground: 0 0% 96%;
    --sidebar-primary: 355 72% 49%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 240 6% 14%;
    --sidebar-accent-foreground: 0 0% 96%;
    --sidebar-border: 0 0% 100% / 0.08;
    --sidebar-ring: 355 72% 49%;
  }
}
```

Notes on what changed and what didn't:
- `:root` (light, the new default) now carries the previously-undefined light palette: near-white background, dark-on-white text, solid light-gray borders.
- `.dark` carries the EXACT dark palette that was previously in `:root` — no visual regression for users who land in dark mode.
- `--scrim` and the football semantic colors (`--win`, `--loss`, `--draw`, `--live`) are defined ONCE in `:root` and inherited by `.dark` (they don't change between themes). That's the canonical CSS-vars cascade behavior.
- Brand `--primary` is defined in BOTH blocks identically — the redundancy is explicit so a future palette tweak in one theme doesn't accidentally leak the other.

- [ ] **Step 2: Verify nothing else in the file regressed**

The rest of `styles.css` (lines 58-69 in the original — the `@layer base { * { ... } body { ... } }` block and the `.ad-container:has(...)` rule) stays untouched. Confirm via `Read` that those sections are still present after your edit.

- [ ] **Step 3: Smoke-test the dev server**

Stop any running dev server. Run: `pnpm dev` (background, wait for `:3000` to bind).

Visit `http://localhost:3000/ar` (the AR surface, primary). Expected: **light theme** is now showing — white background, dark text, brand red links/buttons. The site renders correctly but inverted from before. This is intentional — Task 5 will pin the default back to dark via the ThemeProvider's `defaultTheme="dark"`.

If the page renders BROKEN (e.g., white text on white background, no contrast), check that `:root` block uses the values above exactly. Don't proceed until light renders coherently.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(frontend\)/styles.css
git commit -m "refactor(theme): split tokens into light :root + dark .dark blocks"
```

---

### Task 3: ThemeProvider client wrapper

**Files:**
- Create: `src/components/theme/ThemeProvider.tsx`

- [ ] **Step 1: Create the provider wrapper**

Create [src/components/theme/ThemeProvider.tsx](src/components/theme/ThemeProvider.tsx):

```tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type Props = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: Props) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

> **Why a wrapper:** `next-themes`' `ThemeProvider` is a client component. Server components (our root layouts) can't import client components and pass arbitrary props through cleanly without a thin re-export. This 13-line wrapper is the conventional pattern documented in next-themes' README.

- [ ] **Step 2: Commit**

```bash
git add src/components/theme/ThemeProvider.tsx
git commit -m "feat(theme): add ThemeProvider client wrapper around next-themes"
```

---

### Task 4: Mount ThemeProvider in the frontend layout

**Files:**
- Modify: `src/app/(frontend)/layout.tsx`

- [ ] **Step 1: Wrap children in ThemeProvider**

Open [src/app/(frontend)/layout.tsx](src/app/(frontend)/layout.tsx). Add the import below the other imports:

```tsx
import { ThemeProvider } from "@/components/theme/ThemeProvider";
```

Replace the `<body>` body — currently:

```tsx
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
```

With:

```tsx
      <body
        className={`${plexSans.variable} ${plexArabic.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
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
```

> **Why these props:**
> - `attribute="class"` → next-themes adds/removes the `dark` class on `<html>` (matches Tailwind's `darkMode: "class"` and our `.dark` CSS selector).
> - `defaultTheme="dark"` → preserves the existing brand experience for first-time visitors. Users who explicitly pick light or system override this.
> - `enableSystem` → exposes the "System" option in the toggle. The user's OS preference becomes a valid choice.
> - `disableTransitionOnChange` → prevents the flash of half-transitioned UI when toggling. Standard hygiene.
> - We deliberately do NOT pass `forcedTheme` (would lock theme), `themes={...}` (defaults of `["light","dark","system"]` are correct), or `storageKey` (default localStorage key is fine).

> **Why we leave `suppressHydrationWarning` on `<html>`:** the existing layout already sets it (line 32). next-themes injects the resolved class into `<html>` via a synchronous inline script in the head, which mismatches the SSR-rendered class until hydration. `suppressHydrationWarning` silences React's warning about that.

- [ ] **Step 2: Smoke-test**

Run `pnpm dev` (background, wait for ready). Visit `http://localhost:3000/ar`.
Expected: **dark theme renders** (because `defaultTheme="dark"` is now in effect, even though `:root` is now light).
Open browser dev-tools → Elements panel → inspect `<html>`. Expected: it has `class="dark"`.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(frontend\)/layout.tsx
git commit -m "feat(theme): mount ThemeProvider with defaultTheme=dark + enableSystem"
```

---

### Task 5: Build the ThemeSwitcher component (TDD)

**Files:**
- Create: `src/components/layout/ThemeSwitcher.tsx`
- Create: `src/components/layout/__tests__/ThemeSwitcher.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create [src/components/layout/__tests__/ThemeSwitcher.test.tsx](src/components/layout/__tests__/ThemeSwitcher.test.tsx):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";

// Mock matchMedia for next-themes
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function wrap(ui: React.ReactElement) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {ui}
    </ThemeProvider>,
  );
}

describe("ThemeSwitcher", () => {
  it("renders the trigger with an accessible label", () => {
    wrap(<ThemeSwitcher />);
    expect(screen.getByRole("button", { name: /toggle theme/i })).toBeInTheDocument();
  });

  it("opens the dropdown when clicked", () => {
    wrap(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
    // After click, the three theme options should be reachable
    expect(screen.getByText(/light/i)).toBeInTheDocument();
    expect(screen.getByText(/dark/i)).toBeInTheDocument();
    expect(screen.getByText(/system/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests and confirm failure**

Run: `pnpm test:run src/components/layout/__tests__/ThemeSwitcher.test.tsx 2>&1 | tail -20`
Expected: failure — `Failed to resolve import "@/components/layout/ThemeSwitcher"`.

- [ ] **Step 3: Implement the component**

Create [src/components/layout/ThemeSwitcher.tsx](src/components/layout/ThemeSwitcher.tsx):

```tsx
"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ThemeSwitcher() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Render a stable placeholder server-side / pre-hydration to avoid mismatch.
  // The Sun icon is shown until we know the resolved theme on the client.
  const ActiveIcon = !mounted ? Sun : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Toggle theme">
          <ActiveIcon className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" aria-hidden /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" aria-hidden /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" aria-hidden /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

> **Why the `mounted` guard:** `useTheme()` reads from localStorage on the client; the server-rendered HTML can't know the user's resolved theme. Without the guard, the icon would mismatch between server and client during hydration. Rendering a stable Sun until mounted avoids the flash.

> **Why "Light"/"Dark"/"System" in English not translated:** these labels are universal UI affordances; the icons carry the meaning. Adding them to `messages/*.json` is fine if you want translations, but it's strictly optional and out of scope here.

- [ ] **Step 4: Re-run the tests and confirm they pass**

Run: `pnpm test:run src/components/layout/__tests__/ThemeSwitcher.test.tsx 2>&1 | tail -15`
Expected: 2/2 passing.

If `fireEvent.click` doesn't expand the dropdown in the test env (Radix sometimes needs pointer events), wrap the assertions in `await screen.findByText(...)` and use `userEvent` instead. The provided test uses `fireEvent` which typically works for Radix in jsdom.

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `pnpm test:run 2>&1 | tail -10`
Expected: ≥63 tests passing (61 baseline from previous work + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/ThemeSwitcher.tsx src/components/layout/__tests__/ThemeSwitcher.test.tsx
git commit -m "feat(theme): add ThemeSwitcher dropdown with sun/moon/monitor icons"
```

---

### Task 6: Mount ThemeSwitcher in the Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add the import and mount the component**

Open [src/components/layout/Header.tsx](src/components/layout/Header.tsx). Add the import beside `LanguageSwitcher`:

```tsx
import { ThemeSwitcher } from "./ThemeSwitcher";
```

In the action group (currently lines 30-33), insert `<ThemeSwitcher />` between LanguageSwitcher and MobileNav:

Replace:

```tsx
        {/* Actions */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          <MobileNav locale={locale} />
        </div>
```

with:

```tsx
        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher locale={locale} />
          <MobileNav locale={locale} />
        </div>
```

> **Order rationale:** ThemeSwitcher first (most-likely to be tapped), then LanguageSwitcher, then the mobile-only hamburger. In RTL (`/ar`), the flex order reverses naturally, putting the hamburger on the left — consistent with the existing pattern.

- [ ] **Step 2: Smoke-test the toggle**

Run `pnpm dev` (background, wait). Visit `http://localhost:3000/ar`. Expected: a sun/moon icon button now appears in the header next to "عربي" (the language switcher).

Click it → dropdown opens with Light / Dark / System. Click "Light" → page transitions to white background, dark text, brand red still works. The `<html>` element should now have NO `dark` class (visible in dev-tools).

Click again → switch to "System". Page reflects your OS preference. (If your OS is dark, it goes dark.)

Click "Dark". Back to the boss-approved dark UI.

Reload the page. Expected: the last-chosen theme persists (next-themes uses localStorage by default).

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat(theme): mount ThemeSwitcher in header next to LanguageSwitcher"
```

---

### Task 7: Fix hard-coded `prose-invert` on article body surfaces

**Files:**
- Modify: `src/components/articles/ArticleBody.tsx`
- Modify: `src/components/articles/InArticleAdInjector.tsx`

**Why:** Tailwind Typography's `prose-invert` flips prose colors for dark backgrounds (light text on dark). It's hard-coded on three article-body surfaces today. After Task 2, on light mode the dark `prose-invert` styles produce washed-out / unreadable text on a white background. Gate it behind `dark:`.

- [ ] **Step 1: Update ArticleBody**

Open [src/components/articles/ArticleBody.tsx](src/components/articles/ArticleBody.tsx). On line 11, replace:

```tsx
    <div className="prose prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground leading-arabic">
```

with:

```tsx
    <div className="prose dark:prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground leading-arabic">
```

(Single character change: `prose-invert` → `dark:prose-invert`.)

- [ ] **Step 2: Update InArticleAdInjector**

Open [src/components/articles/InArticleAdInjector.tsx](src/components/articles/InArticleAdInjector.tsx). Lines 35 and 39 both contain the same `prose prose-invert prose-lg ...` string. Apply the same `prose-invert` → `dark:prose-invert` change on both lines.

- [ ] **Step 3: Smoke-test**

Run `pnpm dev`. Visit `http://localhost:3000/ar/articles/demo-botola-matchday-review` (one of the seeded demo articles). Toggle to Light mode. Expected: article body text reads dark-gray on white, headings are dark, links are brand red. No washed-out / low-contrast text.

Toggle back to Dark. Expected: original dark-mode prose styles intact.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/articles/ArticleBody.tsx src/components/articles/InArticleAdInjector.tsx
git commit -m "fix(theme): gate prose-invert behind dark: so light-mode prose renders readable"
```

---

### Task 8: Visual QA pass — light mode across key routes

**Files:** None modified unless issues are found.

- [ ] **Step 1: Capture screenshots in both themes for key surfaces**

Run `pnpm dev` (background, wait). Use Playwright MCP. For each URL below, do:
1. Navigate
2. Set theme to Light via `mcp__plugin_playwright_playwright__browser_evaluate` with `() => localStorage.setItem('theme', 'light')` then reload
3. Screenshot

URLs (locale `ar` covers RTL, the highest-risk surface):

- `http://localhost:3000/ar` → `/tmp/qa-light-ar-home.png`
- `http://localhost:3000/ar/articles/demo-botola-matchday-review` → `/tmp/qa-light-ar-article.png`
- `http://localhost:3000/ar/competition` → `/tmp/qa-light-ar-competitions.png`
- `http://localhost:3000/ar/club/wydad-ac` → `/tmp/qa-light-ar-club.png`
- `http://localhost:3000/ar/this-does-not-exist` → `/tmp/qa-light-ar-404.png`
- `http://localhost:3000/fr` → `/tmp/qa-light-fr-home.png`

Also screenshot a few in Dark mode for comparison:
- `http://localhost:3000/ar` → `/tmp/qa-dark-ar-home.png` (after `localStorage.setItem('theme', 'dark')` + reload)

Save under `./qa-light-*.jpeg` and `./qa-dark-*.jpeg` in the repo root if `/tmp/` isn't writable on Windows.

- [ ] **Step 2: Audit each light-mode screenshot for issues**

Walk through each screenshot and check:
- Background is light, text is dark, brand red works
- Cards have visible borders (the new `--border: 240 6% 90%` is solid gray, not alpha — should show clearly)
- The HeroSection scrim gradient still darkens the bottom of the hero image (it always uses `--scrim`, which stays dark)
- The hero h2 text is still white on top of the dark scrim — readable
- Match cards in the matches/club pages have readable team names
- The 404 page primary button (red on white) has acceptable contrast
- The newsletter input on the footer is visible (it has `bg-background/50` which in light mode is `~50% off-white` — could be hard to see; verify)
- Dropdown menus (language + theme) have readable text and visible separators
- No tokens that didn't get a light variant — look for any pure-black-on-near-black or pure-white-on-near-white

Write issues to `./qa-light-issues.md` with locale + surface + selector + suggested fix per issue.

- [ ] **Step 3: Fix any issues found**

For each issue:
- Open the affected component
- Adjust the offending token (e.g., bump newsletter input contrast by setting `bg-secondary` instead of `bg-background/50`)
- Re-screenshot, mark resolved

If you find a SYSTEMIC issue (e.g., the alpha-border idea works in dark but not light — already handled, light uses solid gray), document it but don't fix beyond the immediate visible problem.

- [ ] **Step 4: Commit any fixes (skip if none)**

```bash
git add -A
git commit -m "fix(theme): polish pass on light-mode contrast across key surfaces"
```

If no fixes were needed: skip the commit and note "no visual issues in light mode QA pass" in Task 9.

---

### Task 9: Pre-merge verification

**Files:** None — verification only.

- [ ] **Step 1: Lint**

Run: `pnpm lint 2>&1 | tail -15`
Expected: no new hard errors in plan-touched files. Pre-existing `react-hooks/set-state-in-effect` in `StickyMobileAd.tsx` remains, out of scope.

- [ ] **Step 2: Tests**

Run: `pnpm test:run 2>&1 | tail -10`
Expected: all green at ≥63 tests (61 baseline + 2 ThemeSwitcher).

- [ ] **Step 3: Production build**

Run: `pnpm build 2>&1 | tail -20`
Expected: completes without error. The new `ThemeSwitcher` and `ThemeProvider` are client components — Next prerenders the rest fine.

- [ ] **Step 4: Manual sanity check**

Run `pnpm start` (background, on :3000 in production mode). Visit `http://localhost:3000/ar` and toggle the theme using the header switcher. Expected: identical visual result to dev mode. No FOUC (flash of unstyled content) on first load — next-themes' inline script prevents this.

Stop the prod server.

- [ ] **Step 5: Commit any fixes from this step (skip if none)**

```bash
git add -A
git commit -m "fix: production build issues from light-mode plan pre-merge check"
```

---

## Out of Scope (do NOT implement in this plan)

- Translating Light/Dark/System labels into ar/fr/en (icons carry the meaning; this is optional polish)
- Changing the default theme to `system` (deliberate: dark stays default to preserve brand experience for first-time visitors)
- Theming the Payload admin (Payload manages its own theme; out of scope)
- Light-mode-only brand palette adjustments (the same Moroccan red is used in both themes deliberately — single brand color)
- Adding a "high contrast" / "AAA" theme variant
- Removing the existing OS-preference `dark:` utilities in `AdLabel`/`StickyMobileAd` — they're now harmonious with the `.dark` class, no work needed

---

## Self-Review

**Spec coverage:**

| Requirement | Covered by |
|---|---|
| Light theme exists with a coherent palette | Task 2 (light tokens in `:root`) |
| Dark theme remains the default | Task 4 (`defaultTheme="dark"`) |
| User-facing toggle in the header | Tasks 5 + 6 (ThemeSwitcher + Header mount) |
| Theme persists across reloads | Task 4 (`next-themes` uses localStorage by default) |
| Respects OS preference if user chooses | Task 4 (`enableSystem`) |
| Article body prose renders correctly in both themes | Task 7 (`dark:prose-invert` gate) |
| No regressions in dark mode | Task 8 (QA pass screenshots both themes) |

All seven sub-requirements mapped. ✓

**Type consistency:**
- `next-themes` API: `useTheme()` returns `{ theme, setTheme, resolvedTheme }`. Used identically in ThemeSwitcher.
- `ThemeProvider` props pass-through via `React.ComponentProps<typeof NextThemesProvider>` — no manual shape drift.
- CSS variable names match between `:root` and `.dark` blocks (verified manually in Task 2).
- Tailwind `darkMode: "class"` and next-themes `attribute="class"` agree on the activation mechanism.

**Placeholder scan:** No "TBD", "implement later", "similar to Task N". Every code step shows the actual code. Every command shows the actual command and expected output.

**Decomposition check:** Tasks 1, 2, 3, 5, 7 are independently shippable. Task 4 depends on Task 3 (provider must exist before layout uses it). Task 6 depends on Task 5 (component must exist before header mounts it). Task 8 is verification of the combined result; Task 9 is the pre-merge gate.

**Risk audit:**
- The CSS token restructure (Task 2) is the highest-risk change — if any token name was renamed accidentally, the dark theme could break. Task 2 step 3's smoke-test gates this.
- next-themes hydration mismatch handled via the `mounted` guard in ThemeSwitcher and `suppressHydrationWarning` on `<html>` (already present).
- The Payload admin's sidebar tokens are duplicated in both blocks — confirmed they're never read by the frontend's components, so the duplication is conservative (won't break Payload).

---

*Plan complete.*
