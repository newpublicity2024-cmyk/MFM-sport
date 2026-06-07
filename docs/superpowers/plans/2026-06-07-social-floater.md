# Social Media Floater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed bottom-right floating social-media button (Instagram as the main icon) that expands upward into a vertical list of the other socials (YouTube, Facebook, X); a second click on the Instagram button opens Instagram; clicking anywhere outside closes the menu.

**Architecture:** One shared, single-source-of-truth social config module (icons + real URLs) consumed by both the new floater and the existing footer. A single client component (`SocialFloater`) holds the open/closed state, the second-click-opens-Instagram behavior, and the click-outside-to-close listener. It is mounted once in the locale layout so it appears site-wide.

**Tech Stack:** Next.js 16 (App Router, RSC + client islands), React 19, Tailwind CSS v3 (`container`, design tokens), Vitest + @testing-library/react. Icon SVGs are reused verbatim from the existing footer (no new icon dependency).

---

## Background (verified facts)

- The footer already defines inline SVG icon components and a `socialLinks` array with **placeholder** URLs: [Footer.tsx:12-49](../../../src/components/layout/Footer.tsx#L12-L49). We will lift those exact SVG paths into a shared module and replace the placeholder URLs with the real ones.
- Real URLs provided by the owner:
  - Facebook → `https://facebook.com/Mfmsport.ma`
  - Instagram → `https://instagram.com/mfmsportofficiel`
  - X → `https://x.com/MfmSport` (the `?s=20` share param is dropped)
  - YouTube → `https://youtube.com/@mfmsport1430`
- **LinkedIn is intentionally skipped** for now (no URL exists yet).
- The floater mounts in [layout.tsx:32-44](../../../src/app/(frontend)/[locale]/layout.tsx#L32-L44), which already renders `<Footer/>` and `<StickyMobileAd/>`. The site is RTL for `ar` (default) but the owner asked for **physical bottom-right**, so we use `right-*` (physical), not a logical inset.
- `cn()` helper lives at `@/lib/utils`. Test convention: `*.test.tsx` under a sibling `__tests__/` dir, `vitest` + `@testing-library/react` (see [AdBanner.test.tsx](../../../src/components/ads/__tests__/AdBanner.test.tsx)).
- Single-file test command: `pnpm test:run <path-substring>`.

## File Structure

- **Create** `src/components/social/icons.tsx` — the 4 social SVG icon components (Facebook, Instagram, X, YouTube), reused by footer + floater.
- **Create** `src/components/social/socialLinks.ts` — single source of truth: each platform's name, real URL, and icon; plus the curated `FOOTER_SOCIALS` and `FLOATER_DROPDOWN` arrays.
- **Create** `src/components/social/SocialFloater.tsx` — the client floater component.
- **Create** `src/components/social/__tests__/SocialFloater.test.tsx` — behavior tests.
- **Modify** `src/app/(frontend)/[locale]/layout.tsx` — mount `<SocialFloater/>` site-wide.
- **Modify** `src/components/layout/Footer.tsx` — consume the shared config (fixes the placeholder URLs + removes duplicated SVGs).

---

### Task 1: Shared social icons module

**Files:**
- Create: `src/components/social/icons.tsx`

- [ ] **Step 1: Create the icons module**

These are the exact SVG paths already used in the footer — just extracted so both footer and floater share them.

```tsx
// src/components/social/icons.tsx
import type { ComponentType } from "react";

export type SocialIconProps = { className?: string };
export type SocialIcon = ComponentType<SocialIconProps>;

export function FacebookIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
    </svg>
  );
}

export function InstagramIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 0 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    </svg>
  );
}

export function XIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

export function YoutubeIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no new type errors referencing `src/components/social/icons.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/social/icons.tsx
git commit -m "feat(social): extract shared social SVG icon components"
```

---

### Task 2: Shared social links config

**Files:**
- Create: `src/components/social/socialLinks.ts`

- [ ] **Step 1: Create the config module**

```ts
// src/components/social/socialLinks.ts
import {
  FacebookIcon,
  InstagramIcon,
  XIcon,
  YoutubeIcon,
  type SocialIcon,
} from "./icons";

export type SocialLink = {
  name: string;
  href: string;
  Icon: SocialIcon;
};

// Single source of truth for MFM Sport's real social URLs.
export const SOCIAL_LINKS = {
  facebook: { name: "Facebook", href: "https://facebook.com/Mfmsport.ma", Icon: FacebookIcon },
  instagram: { name: "Instagram", href: "https://instagram.com/mfmsportofficiel", Icon: InstagramIcon },
  x: { name: "X", href: "https://x.com/MfmSport", Icon: XIcon },
  youtube: { name: "YouTube", href: "https://youtube.com/@mfmsport1430", Icon: YoutubeIcon },
} satisfies Record<string, SocialLink>;

// Footer keeps showing all four, in the existing order.
export const FOOTER_SOCIALS: SocialLink[] = [
  SOCIAL_LINKS.facebook,
  SOCIAL_LINKS.instagram,
  SOCIAL_LINKS.x,
  SOCIAL_LINKS.youtube,
];

// The floater's MAIN button is Instagram; the dropdown lists the OTHER three
// (Instagram is never duplicated). Order requested by owner: YouTube, Facebook, X.
export const FLOATER_MAIN: SocialLink = SOCIAL_LINKS.instagram;
export const FLOATER_DROPDOWN: SocialLink[] = [
  SOCIAL_LINKS.youtube,
  SOCIAL_LINKS.facebook,
  SOCIAL_LINKS.x,
];
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/social/socialLinks.ts
git commit -m "feat(social): single-source social links config with real MFM URLs"
```

---

### Task 3: SocialFloater component (TDD)

**Files:**
- Create: `src/components/social/SocialFloater.tsx`
- Test: `src/components/social/__tests__/SocialFloater.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/social/__tests__/SocialFloater.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import { SocialFloater } from "@/components/social/SocialFloater";

afterEach(() => {
  vi.restoreAllMocks();
});

function getMainButton(container: HTMLElement) {
  // The main Instagram trigger is the only <button> in the floater.
  return container.querySelector("button") as HTMLButtonElement;
}

describe("SocialFloater", () => {
  it("starts collapsed: dropdown hidden, main button not expanded", () => {
    const { container } = render(<SocialFloater />);
    const btn = getMainButton(container);
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    // No social links are reachable while collapsed.
    const menu = container.querySelector("[data-floater-menu]") as HTMLElement;
    expect(menu.getAttribute("aria-hidden")).toBe("true");
  });

  it("first click opens the menu showing YouTube, Facebook, X (Instagram NOT duplicated)", () => {
    const { container } = render(<SocialFloater />);
    fireEvent.click(getMainButton(container));

    expect(getMainButton(container).getAttribute("aria-expanded")).toBe("true");

    const menu = container.querySelector("[data-floater-menu]") as HTMLElement;
    const links = within(menu).getAllByRole("link");
    const labels = links.map((a) => a.getAttribute("aria-label"));
    expect(labels).toEqual(["YouTube", "Facebook", "X"]);
    // Instagram must not appear as a dropdown link.
    expect(labels).not.toContain("Instagram");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://youtube.com/@mfmsport1430",
      "https://facebook.com/Mfmsport.ma",
      "https://x.com/MfmSport",
    ]);
    links.forEach((a) => {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("second click on the main button opens Instagram and keeps the menu open", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(<SocialFloater />);
    const btn = getMainButton(container);

    fireEvent.click(btn); // open
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent.click(btn); // navigate
    expect(openSpy).toHaveBeenCalledWith(
      "https://instagram.com/mfmsportofficiel",
      "_blank",
      "noopener,noreferrer",
    );
    // Still open (NOT toggled closed).
    expect(getMainButton(container).getAttribute("aria-expanded")).toBe("true");
  });

  it("closes when clicking outside the floater", () => {
    const { container } = render(<SocialFloater />);
    fireEvent.click(getMainButton(container));
    expect(getMainButton(container).getAttribute("aria-expanded")).toBe("true");

    fireEvent.mouseDown(document.body);
    expect(getMainButton(container).getAttribute("aria-expanded")).toBe("false");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run src/components/social/__tests__/SocialFloater.test.tsx`
Expected: FAIL — cannot resolve `@/components/social/SocialFloater`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/social/SocialFloater.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FLOATER_DROPDOWN, FLOATER_MAIN } from "./socialLinks";

export function SocialFloater() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const MainIcon = FLOATER_MAIN.Icon;

  // Close when clicking/tapping anywhere outside the floater.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function handleMainClick() {
    // First click opens the menu; a second click (while open) goes to Instagram
    // and intentionally leaves the menu open.
    if (!open) {
      setOpen(true);
      return;
    }
    window.open(FLOATER_MAIN.href, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      ref={rootRef}
      className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3"
    >
      {/* Dropdown — stacks ABOVE the main button and animates upward. */}
      <div
        data-floater-menu
        aria-hidden={!open}
        className={cn(
          "flex flex-col items-center gap-3 transition-all duration-200",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        {FLOATER_DROPDOWN.map(({ name, href, Icon }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            tabIndex={open ? 0 : -1}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow-lg ring-1 ring-border transition-colors hover:text-primary"
          >
            <Icon className="h-5 w-5" />
          </a>
        ))}
      </div>

      {/* Main Instagram trigger. */}
      <button
        type="button"
        onClick={handleMainClick}
        aria-expanded={open}
        aria-label={open ? "Open Instagram" : "Open social menu"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105"
      >
        <MainIcon className="h-7 w-7" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:run src/components/social/__tests__/SocialFloater.test.tsx`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/social/SocialFloater.tsx src/components/social/__tests__/SocialFloater.test.tsx
git commit -m "feat(social): floating bottom-right social menu (Instagram trigger)"
```

---

### Task 4: Mount the floater site-wide

**Files:**
- Modify: `src/app/(frontend)/[locale]/layout.tsx:7-8,40-42`

- [ ] **Step 1: Add the import**

In [layout.tsx](../../../src/app/(frontend)/[locale]/layout.tsx), add after the existing `StickyMobileAd` import (line 8):

```tsx
import { StickyMobileAd } from "@/components/ads/StickyMobileAd";
import { SocialFloater } from "@/components/social/SocialFloater";
```

- [ ] **Step 2: Render the floater**

Change the tail of the layout JSX (currently lines 40-41):

```tsx
        <Footer locale={locale} />
        <StickyMobileAd />
```

to:

```tsx
        <Footer locale={locale} />
        <StickyMobileAd />
        <SocialFloater />
```

- [ ] **Step 3: Verify build + manual check**

Run: `pnpm dev`
Then open `http://localhost:3000/ar` and confirm:
- A round red Instagram button sits at the bottom-right.
- Clicking it reveals YouTube / Facebook / X stacked above it.
- Clicking Instagram again opens `instagram.com/mfmsportofficiel` in a new tab; the menu stays open.
- Clicking elsewhere on the page closes the menu.
Also check `http://localhost:3000/ar` (RTL) keeps the floater on the **right**.

- [ ] **Step 4: Commit**

```bash
git add src/app/(frontend)/[locale]/layout.tsx
git commit -m "feat(social): mount social floater site-wide in locale layout"
```

---

### Task 5: Point the footer at the shared config (fix placeholder URLs, remove dup SVGs)

**Files:**
- Modify: `src/components/layout/Footer.tsx:1-49,88-101`

- [ ] **Step 1: Replace the inline icons + placeholder links with the shared config**

In [Footer.tsx](../../../src/components/layout/Footer.tsx):

1. Add this import near the top imports (after line 4 `BrandLogo`):

```tsx
import { BrandLogo } from "./BrandLogo";
import { FOOTER_SOCIALS } from "@/components/social/socialLinks";
```

2. **Delete** the now-duplicated icon components and the local `socialLinks` array — i.e. remove the entire block from `type SocialIconProps = ...` (line 10) through the closing `];` of `const socialLinks = [...]` (line 49).

3. In the "Social" section, change the map source from `socialLinks` to `FOOTER_SOCIALS` (line 89):

```tsx
          {/* Social */}
          <div className="flex gap-3">
            {FOOTER_SOCIALS.map(({ name, href, Icon }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-11 h-11 rounded-md bg-secondary text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors"
                aria-label={name}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </a>
            ))}
          </div>
```

- [ ] **Step 2: Verify types + full test suite still green**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run: `pnpm test:run`
Expected: all tests pass (no Footer test exists; nothing should break).

- [ ] **Step 3: Manual check**

In `pnpm dev`, scroll to the footer on `/ar`; confirm the four social icons now link to the real URLs (hover to see the `href`, or click).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Footer.tsx
git commit -m "refactor(social): footer reuses shared social config + real URLs"
```

---

## Self-Review

**Spec coverage:**
- Floater bottom-right in the page padding → Task 3 (`fixed bottom-6 right-6`) + Task 4 (mounted site-wide). ✅
- Instagram as the main look → `FLOATER_MAIN = Instagram`, rendered as the button. ✅
- Click opens a dropdown (not Instagram) showing a vertical list → `open` state + `data-floater-menu` column. ✅
- Vertical list = YouTube, Facebook, X (LinkedIn skipped per decision) → `FLOATER_DROPDOWN`. ✅
- Instagram icon not duplicated → it is only the main button; dropdown excludes it; test asserts this. ✅
- Second click leads to Instagram, does not close → `handleMainClick` opens Instagram when already open; test asserts menu stays open. ✅
- Menu closes when clicking anywhere else → `mousedown` outside listener; test asserts. ✅
- Real URLs wired → `SOCIAL_LINKS`. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✅

**Type consistency:** `SocialLink`/`SocialIcon` types are defined in Tasks 1-2 and used unchanged in Task 3. `FLOATER_MAIN`, `FLOATER_DROPDOWN`, `FOOTER_SOCIALS` names are consistent across Tasks 2, 3, 5. ✅

**Note for execution:** This plan is independent of the ads plan and can ship on its own.
