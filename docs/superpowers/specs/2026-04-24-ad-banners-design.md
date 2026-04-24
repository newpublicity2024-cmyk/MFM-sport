# Ad Banners Design

> **Status:** Approved 2026-04-24. Ready for `superpowers:writing-plans`.

## Context

MFM Sport needs elegant, modern ad banners inspired by the beIN Sports website experience. Greenfield — no existing ad code or collections. Trilingual site (ar / fr / en) built on Next.js 16 + Payload 3 + Tailwind.

## Decisions

### Ad source: Google AdSense

Self-serve ad network. No sales team required. Option to migrate to **Google Ad Manager (GAM)** later if direct sponsors appear.

Implications locked in by this choice:

- Revenue starts the moment AdSense approves the site (needs real traffic + content → after WP migration)
- Third-party JS (`pagead2.googlesyndication.com`) loaded via `next/script`
- CMP / consent banner required for EU/UK visitors (GDPR) — **Google Funding Choices** handles this (free, one-click in AdSense dashboard)
- `ads.txt` file required at `/ads.txt` proving publisher identity
- AdSense approval gate: published articles (WP migration complete), privacy/terms pages live, some organic traffic

### Slot inventory (a, c, d, e, f)

| Code | Slot | Where | Reserved height |
|---|---|---|---|
| **a** | Header leaderboard | Every page, above header | 90px desktop / 50px mobile |
| **c** | In-article mid | After 1st paragraph of article body | 280px |
| **d** | In-article bottom | After article body, before related articles | 280px |
| **e** | Between-grid | Every 8 cards on list/category/tag pages | 280px |
| **f** | Sticky mobile bottom | Mobile only, pinned to viewport bottom, dismissible | 50px |

Out of scope: hero-right rail (b), sidebar (g), pre-footer (h).

### Responsive format: Manual responsive units

Each `<AdSlot>` is `data-ad-format="auto"` with `data-full-width-responsive="true"`. Google picks the best size within each fixed container. Container height is reserved in CSS to prevent CLS. Auto Ads and fixed-size breakpoints are rejected.

### CMP: Google Funding Choices

Free. Built into AdSense. Configured in AdSense dashboard — no code on our side beyond loading the AdSense script.

### Admin controls: hardcoded for MVP

Slot positions are hardcoded in page components. No per-article Payload toggles at launch. Can add later if editors request exceptions.

### Label treatment

Thin label + subtle border around every slot. Label text from `next-intl` messages:

- `ar` → `إعلان`
- `fr` → `Publicité`
- `en` → `Advertisement`

Uppercase, 10px, muted color. Border `1px solid` in `border-neutral-200 dark:border-neutral-800`, `rounded-md`, 8px padding. RTL-aware. Label hidden when the slot is empty (ad-block or no fill) so users don't see "Advertisement" over blank space.

### Script loading: eager above-fold, lazy below-fold

The AdSense script is loaded **once** in the root layout via `next/script` with `strategy="afterInteractive"` — after LCP, does not block paint. Per-slot **initialization** (when each `<AdSlot>` calls `window.adsbygoogle.push()`) is independently controlled via the `loading` prop:

- `loading="eager"` → call `push()` immediately on mount. Used for header leaderboard (a).
- `loading="lazy"` → wire an IntersectionObserver; call `push()` only when the slot enters the viewport. Used for c, d, e, f.

## Architecture

### Script placement

In [src/app/(frontend)/layout.tsx](src/app/(frontend)/layout.tsx):

```tsx
{process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
  <Script
    src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}`}
    strategy="afterInteractive"
    crossOrigin="anonymous"
  />
)}
```

Gated on `NEXT_PUBLIC_ADSENSE_CLIENT_ID`. Dev and staging stay clean by omitting the env var. Zero Google requests when unset.

### Rendering model

All ad slots are **client components** — `window.adsbygoogle.push()` is browser-only. Server components pass `slotId` as a prop. No hydration mismatch.

### Component API

```tsx
<AdSlot
  slotId="1234567890"
  format="leaderboard" | "in-article" | "in-grid" | "sticky-mobile"
  loading="eager" | "lazy"
  className?: string
/>
```

One component, four visual presets. Label + border applied internally via `<AdLabel>`.

## Slot catalog

| Slot | format | loading | Reserved height | Mount point |
|---|---|---|---|---|
| a — Header leaderboard | `leaderboard` | `eager` | 90px / 50px | [src/app/(frontend)/layout.tsx](src/app/(frontend)/layout.tsx), above header |
| c — In-article mid | `in-article` | `lazy` | 280px | [src/app/(frontend)/[locale]/articles/[slug]/page.tsx](src/app/(frontend)/[locale]/articles/[slug]/page.tsx), after 1st paragraph |
| d — In-article bottom | `in-article` | `lazy` | 280px | same page, after body, before related |
| e — Between-grid | `in-grid` | `lazy` | 280px | articles list, category, tag pages; every 8 cards |
| f — Sticky mobile bottom | `sticky-mobile` | `lazy` | 50px | [src/app/(frontend)/layout.tsx](src/app/(frontend)/layout.tsx), `md:hidden`, dismissible with `×` |

## Files

### Create

- [src/components/ads/AdSlot.tsx](src/components/ads/AdSlot.tsx) — client component. Renders `<ins class="adsbygoogle">`. Calls `push()` (eager) or wires IntersectionObserver to call `push()` on scroll-in (lazy).
- [src/components/ads/AdLabel.tsx](src/components/ads/AdLabel.tsx) — wrapper with locale-aware label + border.
- [src/components/ads/StickyMobileAd.tsx](src/components/ads/StickyMobileAd.tsx) — fixed-bottom sticky variant. Dismiss button (`×`) stores dismiss state in `sessionStorage`.
- [src/components/ads/InArticleAdInjector.tsx](src/components/ads/InArticleAdInjector.tsx) — takes Lexical-rendered children, injects mid-article slot after first paragraph.
- [src/lib/ads/slots.ts](src/lib/ads/slots.ts) — central map `{ slotName → slotId }`. All IDs live in one file.
- [public/ads.txt](public/ads.txt) — `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` (publisher ID filled after AdSense approval).
- `messages/ar.json`, `messages/fr.json`, `messages/en.json` — add `ads.label` key.

### Modify

- [src/app/(frontend)/layout.tsx](src/app/(frontend)/layout.tsx) — AdSense `<Script>`, header leaderboard `<AdSlot>`, `<StickyMobileAd>`.
- [src/app/(frontend)/[locale]/articles/[slug]/page.tsx](src/app/(frontend)/[locale]/articles/[slug]/page.tsx) — wrap body in `<InArticleAdInjector>`, add bottom `<AdSlot>` before related articles.
- [src/app/(frontend)/[locale]/articles/page.tsx](src/app/(frontend)/[locale]/articles/page.tsx) — inject `<AdSlot format="in-grid">` every 8 cards.
- [src/app/(frontend)/[locale]/category/[slug]/page.tsx](src/app/(frontend)/[locale]/category/[slug]/page.tsx) — same grid injection.
- [src/app/(frontend)/[locale]/tag/[slug]/page.tsx](src/app/(frontend)/[locale]/tag/[slug]/page.tsx) — same grid injection.
- `.env.example` — document `NEXT_PUBLIC_ADSENSE_CLIENT_ID`.

## QA + success criteria

- **CLS**: reserved heights → Lighthouse CLS ≤ 0.02 per slot.
- **LCP**: above-fold leaderboard uses `afterInteractive` → LCP unaffected.
- **Ad-block fallback**: `<AdSlot>` silently collapses when `adsbygoogle` is undefined or blocked. No layout break, no error toast, no console spam.
- **Dev / staging**: with `NEXT_PUBLIC_ADSENSE_CLIENT_ID` unset, zero network requests to Google.
- **Trilingual**: verified in ar / fr / en — label RTL in Arabic, correct word per locale.
- **Empty slots**: label hidden when `<ins>` has no child (no filled creative).

## Out of scope (deferred)

- Google Ad Manager (GAM) migration — until direct sponsors sign
- Programmatic header bidding (Prebid.js) — overkill for launch
- Video preroll ads — needs VAST/VPAID tooling
- A/B testing ad positions — iterate after launch metrics
- Hero-right rail (b), sidebar (g), pre-footer (h) slots
- Per-article admin toggles in Payload

## Environment variable

```
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
```

Required for ads to render. Omit in dev/staging.
