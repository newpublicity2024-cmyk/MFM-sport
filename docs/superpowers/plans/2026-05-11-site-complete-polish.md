# Site Complete Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `mfm-sport` from "boss preview" to "site complete" — every public route that's already in the router renders polished content in all three locales (AR / FR / EN), a localized 404 covers unknown routes, the favicon reads cleanly at 32×32, lint passes in CI, and the merged result deploys cleanly to the same Vercel preview. WordPress migration explicitly stays out of scope (it's the *next* milestone). After this plan merges, the only remaining work before WP migration is deploy-side (Vercel env vars + DNS).

**Architecture:** Five independent slices, each shippable on its own:

1. **Lint repair** — replace the `FlatCompat`-based ESLint 9 config (currently throws `Converting circular structure to JSON` at startup) with a native flat config that loads `@next/eslint-plugin-next` directly. Unblocks CI without changing rule semantics.
2. **Locale parity for static pages** — extend `scripts/seed.ts` to write FR + EN bodies for the four static pages (about / contact / legal / privacy). Schema already supports this: `pages.body` is `localized` in Payload, and `getPageBySlug` already passes the requested locale through. Only the seeded data is missing.
3. **Localized 404** — add `src/app/(frontend)/[locale]/not-found.tsx` so unmatched routes inside the locale segment hit a polished page that respects RTL and renders translated copy. (The only existing `not-found.tsx` lives under `(payload)/admin/` and doesn't cover the public site.)
4. **Glyph favicon** — generate a 32×32 `icon.png` from a glyph-only mark (just "M" on red, or stylized monogram) so the browser-tab icon is legible. The current `icon.png` is the wordmark scaled to 32px and unreadable.
5. **Competition crest spot-fix** — verify the Ligue 1 / FIFA WC 2026 placeholder issue called out in the boss preview handoff. Both api-sports.io URLs (`/leagues/61.png` and `/leagues/1.png`) currently return 200 OK with PNG content (verified during planning), so the bug — if it reproduces — is likely a Next/Image whitelisting or rendering issue, not a missing source. Investigate, fix or close.

After all five land, run a Playwright QA pass across `/fr`, `/en`, and the 404 route, then merge `feat/boss-preview-polish` into `main` and redeploy.

**Tech Stack:** Next.js 16.2.4 / next-intl 4.9 / Payload 3.84.0 / ESLint 9.39 (with native flat config) / sharp 0.34 (for favicon) / Playwright MCP (visual QA) / Vercel CLI (preview deploy).

**Discovered state (verified during planning):**

- Current branch: `feat/boss-preview-polish` at `5d818b6`, **not** yet merged to `main` (`784cdc5`).
- `feat/ad-banners` is **already reachable from main** (`git log feat/ad-banners ^main` returns empty), so the [project_ad_banners memory](../../../C:/Users/bench/.claude/projects/c--Users-bench-OneDrive-Desktop-mfm-sport/memory/project_ad_banners.md) "pending merge" line is stale. No action needed on that branch.
- `pnpm lint` fails immediately with `TypeError: Converting circular structure to JSON` from `eslint-plugin-react` being loaded twice through `FlatCompat`. Reproduced at planning time. See [eslint.config.mjs](eslint.config.mjs).
- `pnpm test:run` passes locally (51 tests, last green on `5d818b6`).
- `pnpm build` succeeds (last green on `5d818b6`).
- `pages.body` field at [src/collections/Pages.ts](src/collections/Pages.ts) is `localized: true`; only the AR locale has real seeded copy. FR and EN return `null` body and the page falls back to the `noContent` translation string ("Contenu en preparation" / "Content coming soon").
- All four static page routes use the same shape — [src/app/(frontend)/[locale]/about/page.tsx](src/app/(frontend)/[locale]/about/page.tsx) and the three siblings — so a single seed change populates all three locales.
- `getPageBySlug` at [src/lib/payload/queries.ts:273](src/lib/payload/queries.ts#L273) already passes `locale` through to Payload, so no query changes are needed.
- Logo SVG at [public/images/logo.svg](public/images/logo.svg) is a **wordmark** ("MFM Sport" in `viewBox="0 0 180 40"`); scaling that to 32×32 produces the unreadable favicon shown when running `Read` against [src/app/apple-icon.png](src/app/apple-icon.png) during planning.
- Both Ligue 1 (apiFootballId `61`) and FIFA WC 2026 (apiFootballId `1`) **do return 200 OK PNGs** from media.api-sports.io — verified with `curl -sI` at planning time. The handoff note describes a placeholder card; investigate whether the issue still reproduces or has been resolved by a later seed run.
- Tests pass on `feat/boss-preview-polish`. The Header test ([src/components/__tests__/Header.test.tsx](src/components/__tests__/Header.test.tsx)) was updated for the SVG logo per `1714965`. Nothing in this plan should regress those.

---

## File Structure

**New files:**
- `src/app/(frontend)/[locale]/not-found.tsx` — localized 404 component (RTL-aware, three-locale text via next-intl)
- `public/images/favicon-source.svg` — single-glyph monogram (32×32 viewBox) used as source for icon generation; checked in for reproducibility
- `scripts/gen-favicon.ts` — one-shot sharp script that converts `favicon-source.svg` → `src/app/icon.png` (32×32) and refreshes `src/app/apple-icon.png` (180×180) using the same source; checked in as a dev tool (not run by build)

**Modified files:**
- `eslint.config.mjs` — replace `FlatCompat.extends(...)` with direct plugin/rule wiring
- `messages/ar.json`, `messages/fr.json`, `messages/en.json` — add a `notFound` namespace (title + body + cta)
- `scripts/seed.ts` — extend `seedPages()` to write FR + EN bodies for all four pages
- `src/app/icon.png` — overwritten with a legible 32×32 glyph render
- `src/app/apple-icon.png` — overwritten with the 180×180 glyph render (current one is the wordmark with white "Sport" that disappears on dark backgrounds)

**Possibly modified (only if Task 8 reproduces the bug):**
- `scripts/seed.ts` — adjust `apiFootballId` for FIFA WC 2026 if id=1 turns out to map to the wrong league in the user's seeded data
- `next.config.ts` — only if a hostname is missing from `images.remotePatterns`

**Regenerated, do not hand-edit:**
- `src/payload-types.ts` — unchanged in this plan (no schema changes)

**Out of scope (do not modify):**
- `scripts/migrate-wp.ts`
- `src/migrations/*`
- `src/collections/*` (no schema changes this plan)
- Ad banner components (`src/components/ads/*`)

---

### Task 1: Repair ESLint flat config

**Why first:** every subsequent commit will benefit from a lint pass surfacing regressions early. Also it's the only task that affects CI gating.

**Files:**
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Run current lint and capture the error**

Run: `pnpm lint 2>&1 | head -20`
Expected: `TypeError: Converting circular structure to JSON` referencing `property 'react' closes the circle` — confirms the pre-existing bug we're about to fix.

- [ ] **Step 2: Replace the config with a native flat config**

Open [eslint.config.mjs](eslint.config.mjs) and replace the entire file with:

```js
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import nextPlugin from '@next/eslint-plugin-next'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const eslintConfig = [
  {
    ignores: [
      '.next/',
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
      'node_modules/',
      'public/',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
    settings: {
      react: { version: 'detect' },
    },
  },
]

export default eslintConfig
```

- [ ] **Step 3: Ensure required plugin packages are installed**

The above config imports `@next/eslint-plugin-next`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-react`, `eslint-plugin-react-hooks`. `eslint-config-next` already declares all of these as dependencies (verify with `pnpm ls @next/eslint-plugin-next eslint-plugin-react eslint-plugin-react-hooks @typescript-eslint/parser @typescript-eslint/eslint-plugin 2>&1 | head -20`).

If any are missing, run:

```bash
pnpm add -D @next/eslint-plugin-next @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks
```

Expected: no install needed in the common case (eslint-config-next 16.2.4 pulls them in). If install was needed, commit `package.json` + `pnpm-lock.yaml` alongside the config change.

- [ ] **Step 4: Re-run lint**

Run: `pnpm lint 2>&1 | tail -30`
Expected: lint **completes** (may print warnings, but no `TypeError`). Specifically, the `Converting circular structure to JSON` error is gone. A clean run prints nothing to stdout; warnings print as numbered findings.

If new errors appear from real code issues in the existing codebase (unlikely — the legacy config never ran successfully so nothing was being checked anyway), capture them in `/tmp/lint-baseline.md` and **do not fix them in this task** — that's an accidental scope explosion. Open a TODO and fix only the new violations that show up on files modified by *this* plan.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs package.json pnpm-lock.yaml 2>/dev/null || git add eslint.config.mjs
git commit -m "fix(lint): replace FlatCompat with native flat config to unblock pnpm lint"
```

---

### Task 2: Add `notFound` translation keys to all three locale message files

**Why:** Task 3 (the 404 page) uses `useTranslations("notFound")` — those keys must exist first or next-intl warns at runtime.

**Files:**
- Modify: `messages/ar.json`
- Modify: `messages/fr.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add `notFound` namespace to ar.json**

Open [messages/ar.json](messages/ar.json). After the `pages` namespace (currently last, lines 133-139), add a comma after the `}` on line 139 and append:

```json
,
  "notFound": {
    "title": "الصفحة غير موجودة",
    "description": "عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
    "backToHome": "العودة إلى الصفحة الرئيسية",
    "browseArticles": "تصفح آخر الأخبار"
  }
```

Resulting file ends:

```json
  "pages": {
    "about": "من نحن",
    "contact": "اتصل بنا",
    "legal": "إشعار قانوني",
    "privacy": "سياسة الخصوصية",
    "noContent": "المحتوى قيد الإعداد"
  },
  "notFound": {
    "title": "الصفحة غير موجودة",
    "description": "عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
    "backToHome": "العودة إلى الصفحة الرئيسية",
    "browseArticles": "تصفح آخر الأخبار"
  }
}
```

- [ ] **Step 2: Add `notFound` namespace to fr.json**

Open [messages/fr.json](messages/fr.json). After the existing `pages` block (lines 133-139), append:

```json
,
  "notFound": {
    "title": "Page introuvable",
    "description": "Désolé, la page que vous cherchez n'existe pas ou a été déplacée.",
    "backToHome": "Retour à l'accueil",
    "browseArticles": "Parcourir les dernières actualités"
  }
```

- [ ] **Step 3: Add `notFound` namespace to en.json**

Open [messages/en.json](messages/en.json). After the existing `pages` block (lines 133-139), append:

```json
,
  "notFound": {
    "title": "Page not found",
    "description": "Sorry, the page you're looking for doesn't exist or has been moved.",
    "backToHome": "Back to home",
    "browseArticles": "Browse the latest news"
  }
```

- [ ] **Step 4: Verify JSON is valid in all three files**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/ar.json','utf8'))" && node -e "JSON.parse(require('fs').readFileSync('messages/fr.json','utf8'))" && node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'))" && echo "ALL VALID"`
Expected: `ALL VALID`. If any file errors, fix the comma placement.

- [ ] **Step 5: Commit**

```bash
git add messages/ar.json messages/fr.json messages/en.json
git commit -m "feat(i18n): add notFound translation keys for ar/fr/en"
```

---

### Task 3: Add localized frontend `not-found.tsx`

**Files:**
- Create: `src/app/(frontend)/[locale]/not-found.tsx`

- [ ] **Step 1: Create the page**

Create [src/app/(frontend)/[locale]/not-found.tsx](src/app/(frontend)/[locale]/not-found.tsx):

```tsx
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations("notFound");

  return (
    <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
      <p className="text-sm uppercase tracking-wider text-muted-foreground mb-4">404</p>
      <h1 className="text-3xl md:text-4xl font-bold mb-4">{t("title")}</h1>
      <p className="text-muted-foreground mb-8">{t("description")}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        >
          {t("backToHome")}
        </Link>
        <Link
          href={`/${locale}/articles`}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-md border border-border bg-card hover:border-primary/30 transition-colors font-medium"
        >
          {t("browseArticles")}
        </Link>
      </div>
    </div>
  );
}
```

> **Why `getLocale()` not `useLocale()`:** in Next 15+ App Router, `not-found.tsx` rendered inside a route group runs as a Server Component. `useTranslations` / `useLocale` are client-only hooks in next-intl. The server-side `getTranslations` / `getLocale` from `next-intl/server` are the correct API for this file.

- [ ] **Step 2: Smoke-test in each locale**

Start dev server: `pnpm dev` (background).

Visit each of these URLs — none of these routes exist, so the locale-scoped 404 should render:
- `http://localhost:3000/ar/this-route-does-not-exist`
- `http://localhost:3000/fr/this-route-does-not-exist`
- `http://localhost:3000/en/this-route-does-not-exist`

Expected for each:
- The header + footer still render (the page is wrapped by `[locale]/layout.tsx`)
- The 404 component shows: "404" stripe, locale-correct title and description, two buttons
- On `/ar/...` the layout is RTL (text right-aligned, buttons reading right-to-left)
- Clicking "Back to home" navigates to `/<locale>` (homepage)

- [ ] **Step 3: Verify no console errors**

Open the dev-tools Console while visiting each URL. Expected: no warnings from next-intl about missing keys; no React hydration errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(frontend\)/\[locale\]/not-found.tsx
git commit -m "feat(404): add localized frontend not-found page (ar/fr/en, RTL-aware)"
```

---

### Task 4: Extend the page-body seeder to write FR + EN bodies

**Files:**
- Modify: `scripts/seed.ts` (specifically the `seedPages` function and surrounding helpers)

- [ ] **Step 1: Define FR + EN body arrays alongside the existing AR bodies**

Open [scripts/seed.ts](scripts/seed.ts). Locate `seedPages` (starts around line 264). Inside the function, leave the existing `aboutBody` / `contactBody` / `legalBody` / `privacyBody` Arabic arrays exactly as-is, and add these directly below them (before the `pages` array definition):

```ts
const aboutBodyFr = [
  "MFM Sport est le portail marocain de référence dédié au football, offrant une couverture complète du championnat national, des sélections marocaines et africaines, ainsi que des grands championnats européens.",
  "Notre mission : proposer un journalisme de fond, mis à jour en temps réel, avec un focus particulier sur le football marocain et les exploits des Lions de l'Atlas.",
  "Notre équipe éditoriale travaille 24 heures sur 24 pour vous apporter les dernières actualités, analyses et statistiques des terrains du monde entier.",
];

const aboutBodyEn = [
  "MFM Sport is Morocco's dedicated football portal, providing comprehensive coverage of the national league, the Moroccan and African national teams, and Europe's top leagues.",
  "We aim to deliver in-depth, real-time editorial content with a particular focus on Moroccan football and the achievements of the Atlas Lions.",
  "Our editorial team works around the clock to bring you the latest news, analysis, and statistics from football grounds around the world.",
];

const contactBodyFr = [
  "Contacter la rédaction : editorial@mfmsport.ma",
  "Publicité et partenariats : ads@mfmsport.ma",
  "Vos contributions et suggestions sont les bienvenues. Suivez-nous également sur nos réseaux sociaux pour un échange direct.",
];

const contactBodyEn = [
  "Editorial team: editorial@mfmsport.ma",
  "Advertising and partnerships: ads@mfmsport.ma",
  "We welcome your contributions and feedback. Follow us on social media for direct interaction.",
];

const legalBodyFr = [
  "Tous les contenus publiés sur MFM Sport sont protégés par les lois marocaines et internationales sur la propriété intellectuelle.",
  "Toute reproduction du contenu sans autorisation écrite préalable de la direction du site est interdite.",
  "MFM Sport décline toute responsabilité quant au contenu des sites externes accessibles via les liens présents sur ce site.",
];

const legalBodyEn = [
  "All content published on MFM Sport is protected by Moroccan and international intellectual property law.",
  "Republication of any content without prior written permission from the site's management is prohibited.",
  "MFM Sport is not responsible for the content of external sites linked from this website.",
];

const privacyBodyFr = [
  "Nous respectons votre vie privée. Nous ne collectons vos données personnelles qu'à l'occasion de votre inscription à la newsletter ou de votre prise de contact avec nous.",
  "Nous utilisons des cookies pour améliorer votre expérience de navigation et mesurer l'audience du site via Google Analytics et Vercel Analytics.",
  "Vous pouvez demander la suppression de vos données à tout moment en écrivant à privacy@mfmsport.ma.",
];

const privacyBodyEn = [
  "We respect your privacy. We only collect personal data when you subscribe to our newsletter or contact us directly.",
  "We use cookies to improve your browsing experience and measure site performance via Google Analytics and Vercel Analytics.",
  "You may request deletion of your data at any time by writing to privacy@mfmsport.ma.",
];
```

- [ ] **Step 2: Extend the `pages` array shape to carry per-locale bodies**

Still inside `seedPages`, replace the existing `pages` array and the loop that follows it (currently lines 291-318 — the whole block from `const pages: Array<...>` through the closing `}` of the `for (const p of pages)` loop) with:

```ts
const pages: Array<{
  title: { ar: string; fr: string; en: string };
  slug: string;
  body: { ar: string[]; fr: string[]; en: string[] };
}> = [
  {
    title: { ar: "من نحن", fr: "À propos", en: "About" },
    slug: "about",
    body: { ar: aboutBody, fr: aboutBodyFr, en: aboutBodyEn },
  },
  {
    title: { ar: "اتصل بنا", fr: "Contact", en: "Contact" },
    slug: "contact",
    body: { ar: contactBody, fr: contactBodyFr, en: contactBodyEn },
  },
  {
    title: { ar: "إشعار قانوني", fr: "Mentions légales", en: "Legal Notice" },
    slug: "legal",
    body: { ar: legalBody, fr: legalBodyFr, en: legalBodyEn },
  },
  {
    title: { ar: "سياسة الخصوصية", fr: "Politique de confidentialité", en: "Privacy Policy" },
    slug: "privacy",
    body: { ar: privacyBody, fr: privacyBodyFr, en: privacyBodyEn },
  },
];

for (const p of pages) {
  const existing = await findBySlug(payload, "pages", p.slug);
  const id = existing?.id;

  // Ensure the page exists (AR is the base locale and required by Payload).
  if (!id) {
    const created = await payload.create({
      collection: "pages",
      data: {
        title: p.title.ar,
        slug: p.slug,
        body: paragraphBody(p.body.ar, "rtl") as any,
      },
      locale: "ar",
      overrideAccess: true,
    });
    console.log(`  [created ar] ${p.title.ar}`);
    // Then layer FR + EN onto the just-created row.
    await payload.update({
      collection: "pages",
      id: created.id,
      data: { title: p.title.fr, body: paragraphBody(p.body.fr, "ltr") as any },
      locale: "fr",
      overrideAccess: true,
    });
    console.log(`  [created fr] ${p.title.fr}`);
    await payload.update({
      collection: "pages",
      id: created.id,
      data: { title: p.title.en, body: paragraphBody(p.body.en, "ltr") as any },
      locale: "en",
      overrideAccess: true,
    });
    console.log(`  [created en] ${p.title.en}`);
    continue;
  }

  // Page exists — re-write each locale (idempotent: replaces the localized body).
  await payload.update({
    collection: "pages",
    id,
    data: { title: p.title.ar, body: paragraphBody(p.body.ar, "rtl") as any },
    locale: "ar",
    overrideAccess: true,
  });
  console.log(`  [updated ar] ${p.title.ar}`);

  await payload.update({
    collection: "pages",
    id,
    data: { title: p.title.fr, body: paragraphBody(p.body.fr, "ltr") as any },
    locale: "fr",
    overrideAccess: true,
  });
  console.log(`  [updated fr] ${p.title.fr}`);

  await payload.update({
    collection: "pages",
    id,
    data: { title: p.title.en, body: paragraphBody(p.body.en, "ltr") as any },
    locale: "en",
    overrideAccess: true,
  });
  console.log(`  [updated en] ${p.title.en}`);
}
```

> **Why the direction differs:** the existing `paragraphBody(paragraphs, direction)` helper writes the Lexical `root.direction` to whatever you pass. RTL is correct for Arabic; LTR is correct for French and English. Passing the wrong direction would force the browser to render the paragraph in the wrong orientation.

- [ ] **Step 3: Stop the dev server, run the seed**

Stop dev server (releases the DB connection). Run: `pnpm seed`
Expected console output snippet for the pages section:

```
--- Seeding Pages ---
  [updated ar] من نحن
  [updated fr] À propos
  [updated en] About
  [updated ar] اتصل بنا
  [updated fr] Contact
  [updated en] Contact
  [updated ar] إشعار قانوني
  [updated fr] Mentions légales
  [updated en] Legal Notice
  [updated ar] سياسة الخصوصية
  [updated fr] Politique de confidentialité
  [updated en] Privacy Policy
```

If any line errors, check the Payload admin for the `pages` collection to confirm rows are intact, then re-run.

- [ ] **Step 4: Spot-check via admin**

Restart dev server. Visit `http://localhost:3000/admin/collections/pages` and open the `about` page. In the admin's locale switcher (top-right), toggle between `ar`, `fr`, `en` — each should show the corresponding title and body.

- [ ] **Step 5: Spot-check the public site**

Visit:
- `http://localhost:3000/ar/about` → existing Arabic copy (unchanged from before)
- `http://localhost:3000/fr/about` → French copy starts with "MFM Sport est le portail marocain de référence..."
- `http://localhost:3000/en/about` → English copy starts with "MFM Sport is Morocco's dedicated football portal..."

Repeat for `/contact`, `/legal`, `/privacy` on each locale.

Expected for each: the heading uses the localized title (not the `t("about")` translation key fallback), and `ArticleBody` renders three paragraphs of real copy.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): seed FR + EN bodies for about/contact/legal/privacy"
```

---

### Task 5: Create glyph-only favicon source SVG

**Files:**
- Create: `public/images/favicon-source.svg`

- [ ] **Step 1: Write the SVG**

Create [public/images/favicon-source.svg](public/images/favicon-source.svg) with a tight glyph mark (red square background + bold white "M"). The glyph is legible at 32×32 because the "M" fills the canvas:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" ry="12" fill="#D92332"/>
  <text x="32" y="46" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="42" fill="#FFFFFF" text-anchor="middle" letter-spacing="-2">M</text>
</svg>
```

> **Why this mark and not the wordmark:** at 32×32 the wordmark's "Sport" portion compresses below readable typography limits. A single letterform fills the canvas, hits the brand red, and reads clearly even in browser tab strips. The full wordmark is still used in the header at 144×32, which has enough horizontal room.

- [ ] **Step 2: Verify the SVG renders**

Open `public/images/favicon-source.svg` directly in a browser (`file:///...` or drag into a tab). Expected: red rounded square with a centered white "M". No console errors.

- [ ] **Step 3: Commit**

```bash
git add public/images/favicon-source.svg
git commit -m "chore(brand): add glyph-only favicon source svg"
```

---

### Task 6: Generate the PNG favicons from the source SVG

**Files:**
- Create: `scripts/gen-favicon.ts`
- Overwrite: `src/app/icon.png`
- Overwrite: `src/app/apple-icon.png`

- [ ] **Step 1: Write the generator script**

Create [scripts/gen-favicon.ts](scripts/gen-favicon.ts):

```ts
/**
 * Regenerate favicons from public/images/favicon-source.svg.
 *
 * Usage:
 *   pnpm tsx scripts/gen-favicon.ts
 *
 * Writes:
 *   src/app/icon.png (32x32)
 *   src/app/apple-icon.png (180x180)
 *
 * Re-run any time the source SVG changes. Not part of the build — the PNG
 * outputs are committed so production builds don't need sharp at build time
 * for this purpose.
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const src = readFileSync(resolve(root, "public/images/favicon-source.svg"));

async function main() {
  await sharp(src).resize(32, 32).png().toFile(resolve(root, "src/app/icon.png"));
  console.log("✓ src/app/icon.png (32x32)");

  await sharp(src).resize(180, 180).png().toFile(resolve(root, "src/app/apple-icon.png"));
  console.log("✓ src/app/apple-icon.png (180x180)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the generator**

Run: `pnpm tsx scripts/gen-favicon.ts`
Expected: two `✓` lines; both PNG files are written.

If `pnpm tsx` is not aliased, use `npx tsx scripts/gen-favicon.ts` instead — `tsx` is already in devDependencies.

- [ ] **Step 3: Verify the generated files**

Use the `Read` tool on `src/app/icon.png` — expected: a red rounded square with a centered white "M", legible at small zoom.

- [ ] **Step 4: Verify in a browser**

Restart dev server. Visit `http://localhost:3000/ar`. Check the browser tab — the favicon should now be a clear "M" on red, not a blurry wordmark.

Also confirm: `http://localhost:3000/icon.png` returns 200 with `Content-Type: image/png` and `Content-Length` smaller than the wordmark version (a flat glyph compresses better).

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-favicon.ts src/app/icon.png src/app/apple-icon.png
git commit -m "chore(brand): regenerate glyph-only favicon + apple-icon"
```

---

### Task 7: Investigate the Ligue 1 / FIFA WC 2026 competition crest issue

**Files:** *(probably none modified — investigation first; fix only if reproduces)*

**Context:** The boss preview handoff (line 43) says: "Ligue 1 + FIFA World Cup 2026 competition cards show a generic placeholder where API-Football's CDN doesn't host their crest at the expected ID." However, planning-time `curl -sI` against `https://media.api-sports.io/football/leagues/61.png` (Ligue 1) and `.../leagues/1.png` (FIFA WC 2026) both returned `HTTP/1.1 200 OK` with PNG content. So either (a) the handoff note is stale, (b) the URLs return *generic* placeholders rather than 404s, or (c) there's a Next/Image rendering issue we missed.

- [ ] **Step 1: Reproduce in browser**

With dev server running, visit `http://localhost:3000/ar/competition`. Locate the Ligue 1 card and the FIFA WC 2026 card. Take a screenshot via Playwright MCP (`mcp__plugin_playwright_playwright__browser_take_screenshot` to `/tmp/competition-grid.png`).

Compare to one of the *known-good* crests on the same grid (e.g., Premier League at id=39). Decision tree:

- **Bug NOT visible** (all 12 crests render real logos): handoff note is stale. Skip Steps 2-3 and add a one-line note in the next commit message ("Verified: Ligue 1 + WC2026 crests render correctly on current seed").
- **Both cards show a grey square placeholder** (the `<div className="h-12 w-12 rounded bg-muted">` fallback at [src/app/(frontend)/[locale]/competition/page.tsx:69](src/app/(frontend)/[locale]/competition/page.tsx#L69)): the `getEntityLogoUrl` helper is returning null → seed isn't writing `logoUrl` → proceed to Step 2.
- **Both cards show a remote-looking but generic image** (api-sports.io returns the same "league placeholder" for both IDs): proceed to Step 3 to swap to a self-hosted asset.

- [ ] **Step 2 (only if `logoUrl` is empty in DB):** Force-update those two seed rows.

Open [scripts/seed.ts:169-184](scripts/seed.ts#L169-L184) — the existing idempotent loop checks `if (!(existing as any).logoUrl)`. If a stale row already has *some* truthy `logoUrl`, the loop skips it. Add a one-shot fix to force-rewrite the two specific competitions:

```ts
// After the main `for (const c of competitions)` loop:
for (const slug of ["ligue-1", "world-cup-2026-competition"]) {
  const c = competitions.find((x) => x.slug === slug);
  if (!c) continue;
  const row = await findBySlug(payload, "competitions", slug);
  if (!row) continue;
  await payload.update({
    collection: "competitions",
    id: row.id,
    data: { logoUrl: `https://media.api-sports.io/football/leagues/${c.apiFootballId}.png` },
    overrideAccess: true,
  });
  console.log(`  [force-rewrote logoUrl] ${c.name}`);
}
```

Then run: `pnpm seed`. Then revisit the page in the browser — expected: real crests render.

- [ ] **Step 3 (only if api-sports.io returns a generic image for those IDs):** Self-host the two crests.

Save a Ligue 1 PNG (200×200, transparent background — find at `https://en.wikipedia.org/wiki/Ligue_1` under "main logo") to `public/images/competitions/ligue-1.png`. Save a FIFA World Cup 2026 PNG to `public/images/competitions/world-cup-2026.png`.

Then update the seed (`scripts/seed.ts`) to override `logoUrl` for just those two slugs with the local path:

```ts
// Inside the main create/update loop, before the create call:
const overrideLogos: Record<string, string> = {
  "ligue-1": "/images/competitions/ligue-1.png",
  "world-cup-2026-competition": "/images/competitions/world-cup-2026.png",
};
const logoUrl = overrideLogos[c.slug] ?? `https://media.api-sports.io/football/leagues/${c.apiFootballId}.png`;
```

And in the existing `if (!(existing as any).logoUrl)` and `if (existing) {` branches, use `logoUrl` instead of the inline template literal.

Re-run `pnpm seed`. Verify the grid renders the local crests. Confirm `next.config.ts` already allows `/images/**` (it does, per the `localPatterns` config added in commit `4304ddf`).

- [ ] **Step 4: Commit the outcome**

If Step 1 found nothing to fix:

```bash
git commit --allow-empty -m "verify: ligue-1 + world-cup-2026 crests render correctly on current seed"
```

If Step 2 fixed it:

```bash
git add scripts/seed.ts
git commit -m "fix(seed): force-rewrite ligue-1 + wc2026 logoUrl bypassing idempotency skip"
```

If Step 3 was needed:

```bash
git add scripts/seed.ts public/images/competitions/
git commit -m "fix(seed): self-host ligue-1 + wc2026 crests (api-sports.io serves generic placeholder)"
```

---

### Task 8: Visual QA pass on FR, EN, 404 (Playwright MCP)

**Files:** None edited unless issues found.

- [ ] **Step 1: Capture the focused-route screenshots**

Ensure dev server is running. Use `mcp__plugin_playwright_playwright__browser_navigate` then `mcp__plugin_playwright_playwright__browser_take_screenshot` (full page) for each:

Desktop viewport (1280×800 — default):
- `http://localhost:3000/fr` → `/tmp/qa-fr-home.png`
- `http://localhost:3000/fr/about` → `/tmp/qa-fr-about.png`
- `http://localhost:3000/fr/contact` → `/tmp/qa-fr-contact.png`
- `http://localhost:3000/fr/legal` → `/tmp/qa-fr-legal.png`
- `http://localhost:3000/fr/privacy` → `/tmp/qa-fr-privacy.png`
- `http://localhost:3000/en` → `/tmp/qa-en-home.png`
- `http://localhost:3000/en/about` → `/tmp/qa-en-about.png`
- `http://localhost:3000/fr/nonexistent-route-test` → `/tmp/qa-fr-404.png`
- `http://localhost:3000/en/nonexistent-route-test` → `/tmp/qa-en-404.png`
- `http://localhost:3000/ar/nonexistent-route-test` → `/tmp/qa-ar-404.png`

Mobile (375×667 — resize first with `mcp__plugin_playwright_playwright__browser_resize`):
- `http://localhost:3000/fr` → `/tmp/qa-fr-home-mobile.png`
- `http://localhost:3000/ar/nonexistent-route-test` → `/tmp/qa-ar-404-mobile.png`
- `http://localhost:3000/fr/about` → `/tmp/qa-fr-about-mobile.png`

- [ ] **Step 2: Audit each screenshot**

For each screenshot, check:
- Page content renders (no empty `"Contenu en preparation"` fallbacks on the static pages — that's the bug Task 4 just fixed)
- Header logo crisp; footer social glyphs intact
- 404 page shows real translated title + description + both CTAs (not raw `notFound.title` keys)
- 404 page is reachable through the header (header is part of layout); the AR 404 is RTL
- No horizontal scroll on mobile
- No raw `[object Object]`, no untranslated keys, no broken images (grey placeholder squares)
- Favicon in the browser tab is the glyph "M" (visible in some screenshots' top chrome — confirm if the screenshot tool captures it)

Write findings to `/tmp/qa-plan-a-issues.md` with one line per issue (locale + viewport + selector + suggested fix).

- [ ] **Step 3: Fix each found issue**

For each row in the issues file:
- Open the affected component/page
- Make the minimal fix
- Re-screenshot the offending viewport
- Mark resolved in the issues file

If a fix touches a component not listed in this plan's File Structure section, the change is in-scope only if it's a one-line tweak. If a real component refactor is needed, **stop and ask the user** rather than expanding scope.

- [ ] **Step 4: Commit any fixes (skip if none)**

```bash
git add -A
git commit -m "fix(layout): polish pass on fr/en/404 surfaces — boss preview round 2"
```

If no fixes were needed: skip the commit and note "no QA issues found" in Task 10's handoff update.

---

### Task 9: Pre-merge verification — full lint + tests + production build

**Files:** None — verification only.

- [ ] **Step 1: Lint**

Run: `pnpm lint 2>&1 | tail -30`
Expected: completes without `TypeError`. Warnings are acceptable (treat as future cleanup). If a hard error appears that's tied to files modified in this plan, fix it now and recommit.

- [ ] **Step 2: Tests**

Run: `pnpm test:run 2>&1 | tail -20`
Expected: all green (counts should match or exceed the 51 previously-passing tests).

- [ ] **Step 3: Production build**

Run: `pnpm build 2>&1 | tail -40`
Expected: build completes. The new `not-found.tsx` is rendered statically per locale; check for any output line about "static generation: 3/3 locales" or similar — if Next reports an error generating the 404 (e.g., `useTranslations` being incorrectly imported instead of `getTranslations`), revisit Task 3.

- [ ] **Step 4: Production server smoke test**

Run: `pnpm start` (background, on default :3000).
Visit `http://localhost:3000/fr/about` and `http://localhost:3000/ar/nonexistent-test` — expected: identical visual result to dev mode.

Stop the prod server (`Ctrl+C` or kill the background process).

- [ ] **Step 5: Commit any build-driven fixes (skip if none)**

If the build surfaced a TS error or static-gen failure, fix the root cause and commit:

```bash
git add -A
git commit -m "fix: production build issues surfaced during plan-a pre-merge check"
```

---

### Task 10: Merge to main, deploy preview, update handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-05-06-boss-preview-handoff.md`
- (Branch action: merge `feat/boss-preview-polish` → `main`)

- [ ] **Step 1: Confirm working tree is clean and on the right branch**

Run: `git status` and `git rev-parse --abbrev-ref HEAD`
Expected: working tree clean, currently on `feat/boss-preview-polish`.

- [ ] **Step 2: Merge `feat/boss-preview-polish` into `main`**

```bash
git checkout main
git merge --no-ff feat/boss-preview-polish -m "merge: boss preview polish + site complete polish into main"
```

`--no-ff` forces a merge commit so the branch's grouped history stays visible. If the merge fast-forwards (no merge commit), that's also fine.

If a merge conflict appears (unlikely given `main` hasn't moved past `784cdc5`), resolve it manually, do not `--abort` and retry destructively without telling the user.

- [ ] **Step 3: Try to push `main` to remote**

```bash
git push origin main
```

Expected: either succeeds (then proceed), or fails with the same auth issue noted in the boss preview handoff. If it fails:
- Do **not** force-push or rewrite credentials. The handoff doc notes this is a known credentials issue.
- Capture the error in the handoff update (Step 5) and ask the user to push manually after configuring credentials for the right GitHub account.

- [ ] **Step 4: Trigger a Vercel preview deploy**

The Vercel project should auto-deploy main on push. If push failed in Step 3, deploy manually from local:

```bash
npx vercel --no-clipboard --prod=false
```

Expected: build completes, prints a preview URL (form `https://mfm-sport-<hash>.vercel.app`). Build time ~3-5 min. If env vars are missing, surface the error to the user — do not paper over.

- [ ] **Step 5: Update the boss preview handoff doc**

Open [docs/superpowers/specs/2026-05-06-boss-preview-handoff.md](docs/superpowers/specs/2026-05-06-boss-preview-handoff.md). Add a new section directly after the "What's NOT in this preview" block (around line 39):

```markdown
## Round 2 polish (2026-05-11)

Plan: [docs/superpowers/plans/2026-05-11-site-complete-polish.md](../plans/2026-05-11-site-complete-polish.md)

- ESLint 9 flat config repaired (`pnpm lint` now runs)
- FR + EN bodies seeded for About / Contact / Legal / Privacy — all three locale variants now render real copy
- Localized 404 page added for `/ar`, `/fr`, `/en` — unknown routes hit a polished, RTL-aware page instead of Next's default
- Glyph-only favicon (32×32) replaces the unreadable scaled wordmark
- Ligue 1 + FIFA WC 2026 crests verified / fixed (see plan Task 7 for outcome)

**Built from commit:** `<git rev-parse --short HEAD>`
**Preview URL:** `<paste deploy URL>`
```

Replace `<git rev-parse --short HEAD>` with the actual short hash (run the command, paste the value). Replace `<paste deploy URL>` with the URL printed by `vercel` (or note the auto-deploy URL if push succeeded).

- [ ] **Step 6: Commit the handoff update**

```bash
git add docs/superpowers/specs/2026-05-06-boss-preview-handoff.md
git commit -m "docs: handoff update for round-2 polish (site complete)"
```

If push to `main` worked in Step 3, push this commit too:

```bash
git push origin main
```

If push didn't work, leave the commit local and note in the user-facing summary.

- [ ] **Step 7: Hand off to the user**

In the agent's final message, print:
- The Vercel preview URL (and a note: same `mfm-sport.vercel.app` alias as Round 1 if auto-deploy was used; new hashed URL if manual)
- The git state: which branch holds the work, whether `main` is pushed
- A one-line confirmation that the remaining work before WP migration is now deploy-side only (env vars + DNS — these don't need a written plan; they're console clicks)

---

## Out of Scope (do NOT implement in this plan)

- WordPress migration (`pnpm migrate:wp`) — that's the next milestone, with its own plan and a 200-article cap per [project_wp_migration_scope memory](../../../memory/project_wp_migration_scope.md)
- Vercel env vars (`BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN`) — deploy-side, user does this in the Vercel dashboard
- DNS for `mfmsport.ma` + Resend domain verification — deploy-side
- AdSense activation — separate workflow (see [project_ad_banners memory](../../../memory/project_ad_banners.md))
- Squad / player profile pages — Phase 2
- French / English variants of dynamic article bodies (the demo articles are already trilingual per seed-preview; if any aren't, that's a seed-preview fix, not a static-pages fix)
- Visual redesign of any component beyond fixes called out by Task 8

---

## Self-Review

**Spec coverage check (against the punch list in the preceding message):**

| Punch-list item | Covered by |
|---|---|
| Push branch / merge to main | Task 10 (with graceful fallback if credentials fail) |
| Fix ESLint 9 / FlatCompat error | Task 1 |
| FR + EN translations of static pages | Tasks 2 (i18n keys) + 4 (page bodies) |
| Frontend 404 page | Task 3 |
| Legible favicon | Tasks 5 + 6 |
| Ligue 1 + WC2026 crest investigation | Task 7 |
| Plan A pre-merge verification | Task 9 |
| Hand off to boss | Task 10 |

All seven punch-list items are mapped. ✓

**Type consistency check:**
- `paragraphBody(paragraphs, direction)` signature used identically in Task 4 (existing helper from Task 4's reference point [scripts/seed.ts:27-47](scripts/seed.ts#L27-L47)) — no new arguments introduced
- `getEntityLogoUrl(entity)` mentioned only in Task 7 reference, not modified — already shipped in commit `df65d26`
- Translation namespace `notFound` keys (`title`, `description`, `backToHome`, `browseArticles`) — used identically in Task 2 (JSON definition) and Task 3 (consumer)
- Page slugs (`about`, `contact`, `legal`, `privacy`) — used identically in Task 4 (seed) and the existing four page routes (verified during planning, all four files share an identical structure)

**Placeholder scan:**
- No "TBD", "implement later", "similar to Task N", or "add appropriate error handling" anywhere in this plan
- Every code step shows the actual code
- Every command shows the actual command and expected output
- Task 7 has three explicit branches (Step 1 decision tree → Step 2 / Step 3 / no-op), so the engineer doesn't have to guess what to do based on what they see; each branch produces a concrete commit

**Decomposition check:** Tasks 1, 2, 3, 4, 5, 6 are independently shippable. Task 7 depends on running the seed once (so Task 4's `pnpm seed` already executed) but its outcome is an optional fix. Tasks 8, 9, 10 are the verification + ship sequence and require all prior tasks to be committed. No task hides a hidden dependency on a non-modified file.

**Risk audit:**
- ESLint config rewrite (Task 1) could surface latent issues in existing code that the broken config was masking. Mitigation: capture them in `/tmp/lint-baseline.md` and scope the fix to only newly-modified files in this plan.
- Re-seeding pages (Task 4) writes to FR + EN locales of the same row, so an existing AR-only page becomes a fully-localized page. This is the intended outcome and reversible (re-run seed with the old AR-only code if needed).
- Merge to main (Task 10) is the only step that affects shared history. Step 3's push has an explicit fallback for the credentials issue called out in the existing handoff doc — we don't force-push or rewrite history.

---

*Plan complete.*
