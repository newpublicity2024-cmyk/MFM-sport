# MFM Sport — Plan 1: Foundation & Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Next.js 15 + Payload 3.0 app with dark Moroccan design system, trilingual i18n (AR/FR/EN with RTL), 4 foundation CMS collections, and a styled layout shell (header + footer + nav).

**Architecture:** Next.js 15 App Router with Payload 3.0 installed in-app. Route groups separate frontend `(frontend)/[locale]/` from Payload admin `(payload)/admin/`. next-intl handles locale routing with middleware. Design tokens flow through CSS custom properties into Tailwind + shadcn/ui.

**Tech Stack:** Next.js 15, TypeScript, Payload 3.0, Neon Postgres, Tailwind CSS, shadcn/ui, next-intl, IBM Plex Sans Arabic + IBM Plex Sans, Vitest

---

## Master Roadmap (5 Plans)

| Plan | Scope | Depends On | Deliverable |
|------|-------|------------|-------------|
| **1. Foundation** (this) | Scaffolding, design system, i18n, layout shell, base collections | — | Running app with CMS + design + i18n + layout |
| **2. Editorial Pages** | articles, authors collections; homepage, article, category, tag, author, search pages | Plan 1 | Full editorial reading experience |
| **3. Football Data** | clubs, competitions collections; API-Football service; matches, competition, club pages | Plan 1 | Data-driven football pages |
| **4. Engagement** | subscribers collection; newsletter (Resend); videos hub; static pages (about, contact, legal, privacy) | Plans 1-2 | Newsletter + video + info pages |
| **5. SEO & Launch** | redirects collection; WP migration script; sitemap, robots, RSS, OG images; legacy redirect middleware | Plans 1-4 | Production-ready launch |

**Estimated timeline:** Plan 1 = ~4 days, Plan 2 = ~8 days, Plan 3 = ~8 days, Plan 4 = ~5 days, Plan 5 = ~6 days. Buffer = 12 days. Total = 52 days.

---

## Prerequisites

Before starting, verify these are installed:

```bash
node --version    # Expected: v20.x or v22.x
pnpm --version    # Expected: v9.x+ (install via: corepack enable && corepack prepare pnpm@latest --activate)
git --version     # Expected: any recent version
```

If `pnpm` is not installed:
```bash
npm install -g pnpm
```

---

## File Structure (end state of Plan 1)

```
mfm-sport/
├── docs/superpowers/plans/          # This plan
├── messages/
│   ├── ar.json                      # Arabic UI strings
│   ├── fr.json                      # French UI strings
│   └── en.json                      # English UI strings
├── public/
│   └── images/
│       └── logo.svg                 # Placeholder logo
├── src/
│   ├── app/
│   │   ├── (frontend)/
│   │   │   └── [locale]/
│   │   │       ├── layout.tsx       # Locale layout (direction, fonts, header/footer)
│   │   │       └── page.tsx         # Homepage placeholder
│   │   ├── (payload)/
│   │   │   └── admin/
│   │   │       └── [[...segments]]/
│   │   │           ├── page.tsx     # Payload admin (from scaffold)
│   │   │           └── not-found.tsx
│   │   ├── my-route/
│   │   │   └── route.ts            # Payload internal (from scaffold)
│   │   └── layout.tsx               # Root layout (html, body, fonts)
│   ├── collections/
│   │   ├── Users.ts                 # Admin users with roles
│   │   ├── Media.ts                 # Images (Vercel Blob in prod)
│   │   ├── Categories.ts           # Hierarchical, localized
│   │   └── Tags.ts                  # Flat, localized
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Nav.tsx
│   │   │   ├── LanguageSwitcher.tsx
│   │   │   └── MobileNav.tsx
│   │   └── ui/                      # shadcn/ui components
│   ├── i18n/
│   │   ├── routing.ts               # Locale definitions
│   │   └── request.ts               # Server-side message loading
│   ├── lib/
│   │   └── utils.ts                 # cn() helper (shadcn)
│   ├── test/
│   │   └── setup.ts                 # Vitest setup
│   ├── payload.config.ts            # Payload configuration
│   └── payload-types.ts             # Auto-generated types
├── .env.example
├── .env                             # Local env (gitignored)
├── .gitignore
├── components.json                  # shadcn/ui config
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── package.json
├── pnpm-lock.yaml
└── PROJECT_MEMORY.md
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: entire project via `create-payload-app`
- Preserve: `PROJECT_MEMORY.md`

- [ ] **Step 1: Back up PROJECT_MEMORY.md**

```bash
cp "C:/Users/bench/OneDrive/Desktop/mfm-sport/PROJECT_MEMORY.md" "C:/Users/bench/OneDrive/Desktop/PROJECT_MEMORY.md.bak"
```

- [ ] **Step 2: Scaffold with create-payload-app**

Run from the Desktop directory (parent of mfm-sport). The tool will create a new project:

```bash
cd "C:/Users/bench/OneDrive/Desktop"
pnpm dlx create-payload-app@latest mfm-sport-temp -t blank --db postgres
```

If the interactive prompt appears instead, select:
- Project name: `mfm-sport-temp`
- Template: `blank`
- Database: `postgres`

- [ ] **Step 3: Move scaffold files into project directory**

```bash
cp -r "C:/Users/bench/OneDrive/Desktop/mfm-sport-temp/"* "C:/Users/bench/OneDrive/Desktop/mfm-sport/"
cp -r "C:/Users/bench/OneDrive/Desktop/mfm-sport-temp/".* "C:/Users/bench/OneDrive/Desktop/mfm-sport/" 2>/dev/null || true
rm -rf "C:/Users/bench/OneDrive/Desktop/mfm-sport-temp"
```

- [ ] **Step 4: Restore PROJECT_MEMORY.md**

```bash
cp "C:/Users/bench/OneDrive/Desktop/PROJECT_MEMORY.md.bak" "C:/Users/bench/OneDrive/Desktop/mfm-sport/PROJECT_MEMORY.md"
rm "C:/Users/bench/OneDrive/Desktop/PROJECT_MEMORY.md.bak"
```

- [ ] **Step 5: Install additional dependencies**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport"
pnpm add next-intl @payloadcms/storage-vercel-blob
pnpm add -D tailwindcss @tailwindcss/postcss postcss autoprefixer vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @types/react @types/react-dom
```

Note: some of these may already exist from the scaffold. pnpm handles duplicates gracefully.

- [ ] **Step 6: Initialize git and make first commit**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport"
git init
git add -A
git commit -m "chore: scaffold Next.js 15 + Payload 3.0 blank template"
```

- [ ] **Step 7: Verify dev server starts**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport"
pnpm dev
```

Expected: Server starts on `http://localhost:3000`. May show DB connection error (expected — we haven't configured the database yet). Press Ctrl+C to stop.

---

## Task 2: Environment & Database

**Files:**
- Create: `.env.example`
- Modify: `.env` (gitignored)

- [ ] **Step 1: Create .env.example**

Create `.env.example` at project root:

```env
# Database (Neon Postgres)
DATABASE_URI=postgresql://user:password@host/database?sslmode=require

# Payload
PAYLOAD_SECRET=generate-a-64-char-random-string-here

# Vercel Blob (only needed in production)
BLOB_READ_WRITE_TOKEN=

# Sentry (added in Task 10)
SENTRY_DSN=

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Configure .env with real values**

Edit `.env` (created by scaffold) to include:

```env
DATABASE_URI=postgresql://YOUR_NEON_CONNECTION_STRING?sslmode=require
PAYLOAD_SECRET=GENERATE_WITH: openssl rand -hex 32
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

To generate the secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `PAYLOAD_SECRET`.

**Important:** The user needs to create a Neon project at https://neon.tech and copy the connection string. If no Neon project exists yet, create one named `mfm-sport` and copy the connection string from the dashboard.

- [ ] **Step 3: Verify database connection**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport"
pnpm dev
```

Expected: Server starts, Payload connects to Neon, creates tables automatically. Navigate to `http://localhost:3000/admin` — you should see the Payload admin setup screen (create first user). Press Ctrl+C after verifying.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: add environment variable template"
```

Note: `.env` is gitignored by default. Do NOT commit it.

---

## Task 3: Design Tokens & Tailwind

**Files:**
- Modify: `src/app/(payload)/custom.scss` or `src/app/globals.css` (whichever the scaffold created)
- Create: `src/app/globals.css` (if not exists)
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Write globals.css with Moroccan dark palette**

Create or replace `src/app/globals.css`:

```css
@import "tailwindcss";

/*
 * MFM Sport — Moroccan Dark Theme
 * Design tokens as CSS custom properties for shadcn/ui + Tailwind
 */

@layer base {
  :root {
    /* Backgrounds */
    --background: 240 6% 6%;           /* #0E0E10 near-black */
    --foreground: 0 0% 96%;            /* #F5F5F5 */

    --card: 240 5% 11%;               /* #1A1A1D surface */
    --card-foreground: 0 0% 96%;

    --popover: 240 5% 11%;
    --popover-foreground: 0 0% 96%;

    /* Brand */
    --primary: 355 72% 49%;           /* #D92332 Moroccan red */
    --primary-foreground: 0 0% 100%;

    --secondary: 240 6% 14%;          /* #222226 elevated */
    --secondary-foreground: 0 0% 96%;

    --muted: 240 6% 14%;
    --muted-foreground: 220 9% 46%;   /* #6B7280 */

    --accent: 37 91% 55%;             /* #F5A623 amber */
    --accent-foreground: 0 0% 6%;

    --destructive: 0 84% 60%;         /* #EF4444 */
    --destructive-foreground: 0 0% 100%;

    /* Borders */
    --border: 0 0% 100% / 0.08;
    --input: 0 0% 100% / 0.08;
    --ring: 355 72% 49%;

    --radius: 0.5rem;

    /* Semantic — football-specific */
    --win: 160 60% 45%;               /* #10B981 */
    --loss: 0 84% 60%;                /* #EF4444 */
    --draw: 38 92% 50%;               /* #F59E0B */
    --live: 38 92% 50%;               /* #F59E0B */

    /* Sidebar (Payload admin, shadcn default) */
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

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 2: Update tailwind.config.ts**

Replace `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Football semantic colors
        win: "hsl(var(--win))",
        loss: "hsl(var(--loss))",
        draw: "hsl(var(--draw))",
        live: "hsl(var(--live))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        arabic: ["var(--font-plex-arabic)", "var(--font-plex-sans)", "system-ui", "sans-serif"],
      },
      lineHeight: {
        arabic: "1.7",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Verify tokens render**

```bash
pnpm dev
```

Navigate to `http://localhost:3000`. The page background should be near-black (`#0E0E10`). Text should be light (`#F5F5F5`). If the scaffold has a default page, it should render with the dark theme.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "feat: add Moroccan dark design tokens and Tailwind config"
```

---

## Task 4: Fonts (IBM Plex Sans Arabic + IBM Plex Sans)

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Configure fonts in root layout**

Modify `src/app/layout.tsx` to load both font families via `next/font/google`:

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexArabic.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

Note: The `lang` and `dir` attributes on `<html>` will be set by the locale layout (Task 8). We omit them here to avoid hydration mismatches.

- [ ] **Step 2: Verify fonts load**

```bash
pnpm dev
```

Open DevTools → Network → filter by "font". Confirm IBM Plex Sans and IBM Plex Sans Arabic font files are downloaded.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: configure IBM Plex Sans Arabic + Latin fonts"
```

---

## Task 5: shadcn/ui Setup

**Files:**
- Create: `components.json`, `src/lib/utils.ts`, `src/components/ui/`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd "C:/Users/bench/OneDrive/Desktop/mfm-sport"
pnpm dlx shadcn@latest init
```

If interactive, select:
- Style: **New York**
- Base color: **Neutral** (we override with our tokens)
- CSS variables: **Yes**
- `tailwind.config.ts` path: `tailwind.config.ts`
- Components path: `src/components/ui`
- Utils path: `src/lib/utils`

If shadcn modifies `globals.css` or `tailwind.config.ts`, revert those changes — we already have our custom versions from Task 3. Keep only `components.json` and `src/lib/utils.ts`.

- [ ] **Step 2: Install base components**

```bash
pnpm dlx shadcn@latest add button card badge input separator sheet dropdown-menu scroll-area skeleton
```

- [ ] **Step 3: Verify components render**

Create a temporary test: navigate to `http://localhost:3000` (or any page) and inspect that the `src/components/ui/` directory contains the installed components.

```bash
ls src/components/ui/
```

Expected: `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `separator.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `scroll-area.tsx`, `skeleton.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components.json src/lib/utils.ts src/components/ui/
git commit -m "feat: initialize shadcn/ui with base components"
```

---

## Task 6: i18n (next-intl)

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `messages/ar.json`, `messages/fr.json`, `messages/en.json`, `src/middleware.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Create i18n routing config**

Create `src/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ar", "fr", "en"],
  defaultLocale: "ar",
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 2: Create i18n request config**

Create `src/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: Create Arabic messages**

Create `messages/ar.json`:

```json
{
  "nav": {
    "home": "الرئيسية",
    "news": "أخبار",
    "competitions": "مسابقات",
    "matches": "مباريات",
    "videos": "فيديو"
  },
  "footer": {
    "about": "من نحن",
    "contact": "اتصل بنا",
    "legal": "إشعار قانوني",
    "privacy": "سياسة الخصوصية",
    "rights": "جميع الحقوق محفوظة",
    "followUs": "تابعنا"
  },
  "common": {
    "loading": "جاري التحميل...",
    "error": "حدث خطأ",
    "readMore": "اقرأ المزيد",
    "share": "مشاركة",
    "language": "اللغة",
    "search": "بحث"
  },
  "newsletter": {
    "title": "اشترك في نشرتنا الإخبارية",
    "subtitle": "احصل على آخر الأخبار مباشرة في بريدك",
    "placeholder": "بريدك الإلكتروني",
    "subscribe": "اشترك الآن",
    "success": "تم الاشتراك بنجاح!"
  },
  "home": {
    "topNews": "أهم الأخبار",
    "latestNews": "آخر الأخبار",
    "todayMatches": "مباريات اليوم"
  }
}
```

- [ ] **Step 4: Create French messages**

Create `messages/fr.json`:

```json
{
  "nav": {
    "home": "Accueil",
    "news": "Actualites",
    "competitions": "Competitions",
    "matches": "Matchs",
    "videos": "Videos"
  },
  "footer": {
    "about": "A propos",
    "contact": "Contact",
    "legal": "Mentions legales",
    "privacy": "Politique de confidentialite",
    "rights": "Tous droits reserves",
    "followUs": "Suivez-nous"
  },
  "common": {
    "loading": "Chargement...",
    "error": "Une erreur est survenue",
    "readMore": "Lire la suite",
    "share": "Partager",
    "language": "Langue",
    "search": "Rechercher"
  },
  "newsletter": {
    "title": "Inscrivez-vous a notre newsletter",
    "subtitle": "Recevez les dernieres actualites directement dans votre boite",
    "placeholder": "Votre email",
    "subscribe": "S'inscrire",
    "success": "Inscription reussie !"
  },
  "home": {
    "topNews": "A la une",
    "latestNews": "Dernieres actualites",
    "todayMatches": "Matchs du jour"
  }
}
```

- [ ] **Step 5: Create English messages**

Create `messages/en.json`:

```json
{
  "nav": {
    "home": "Home",
    "news": "News",
    "competitions": "Competitions",
    "matches": "Matches",
    "videos": "Videos"
  },
  "footer": {
    "about": "About",
    "contact": "Contact",
    "legal": "Legal Notice",
    "privacy": "Privacy Policy",
    "rights": "All rights reserved",
    "followUs": "Follow Us"
  },
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "readMore": "Read more",
    "share": "Share",
    "language": "Language",
    "search": "Search"
  },
  "newsletter": {
    "title": "Subscribe to our newsletter",
    "subtitle": "Get the latest news directly in your inbox",
    "placeholder": "Your email",
    "subscribe": "Subscribe",
    "success": "Successfully subscribed!"
  },
  "home": {
    "topNews": "Top News",
    "latestNews": "Latest News",
    "todayMatches": "Today's Matches"
  }
}
```

- [ ] **Step 6: Create middleware**

Create `src/middleware.ts`:

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all paths except API routes, Payload admin, Next.js internals, and static files
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
```

- [ ] **Step 7: Update next.config.ts**

Modify `next.config.ts` to include the next-intl plugin alongside Payload's `withPayload`:

```ts
import { withPayload } from "@payloadcms/next/withPayload";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig = {};

export default withPayload(withNextIntl(nextConfig));
```

- [ ] **Step 8: Verify i18n routing**

```bash
pnpm dev
```

Test these URLs:
- `http://localhost:3000/` — should redirect to `/ar/`
- `http://localhost:3000/ar/` — Arabic homepage (may be empty page, but no errors)
- `http://localhost:3000/fr/` — French
- `http://localhost:3000/en/` — English
- `http://localhost:3000/admin` — Payload admin (should NOT redirect to `/ar/admin`)

- [ ] **Step 9: Commit**

```bash
git add src/i18n/ messages/ src/middleware.ts next.config.ts
git commit -m "feat: add next-intl trilingual routing (AR/FR/EN)"
```

---

## Task 7: Payload Collections

**Files:**
- Modify: `src/collections/Users.ts`
- Create: `src/collections/Media.ts`, `src/collections/Categories.ts`, `src/collections/Tags.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Enhance Users collection with roles**

Replace `src/collections/Users.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: {
    useAsTitle: "email",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Viewer", value: "viewer" },
      ],
    },
  ],
};
```

- [ ] **Step 2: Create Media collection**

Create `src/collections/Media.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Media: CollectionConfig = {
  slug: "media",
  upload: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    imageSizes: [
      {
        name: "thumbnail",
        width: 300,
        height: 200,
        position: "centre",
      },
      {
        name: "card",
        width: 600,
        height: 400,
        position: "centre",
      },
      {
        name: "hero",
        width: 1200,
        height: 630,
        position: "centre",
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "caption",
      type: "text",
      localized: true,
    },
  ],
};
```

- [ ] **Step 3: Create Categories collection**

Create `src/collections/Categories.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Categories: CollectionConfig = {
  slug: "categories",
  admin: {
    useAsTitle: "name",
  },
  fields: [
    {
      name: "name",
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
        description: "URL-friendly identifier (ASCII, lowercase, hyphens)",
      },
    },
    {
      name: "parent",
      type: "relationship",
      relationTo: "categories",
      admin: {
        description: "Parent category for hierarchical structure",
      },
    },
    {
      name: "description",
      type: "textarea",
      localized: true,
    },
  ],
};
```

- [ ] **Step 4: Create Tags collection**

Create `src/collections/Tags.ts`:

```ts
import type { CollectionConfig } from "payload";

export const Tags: CollectionConfig = {
  slug: "tags",
  admin: {
    useAsTitle: "name",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
    },
  ],
};
```

- [ ] **Step 5: Update payload.config.ts**

Replace `src/payload.config.ts` with the full configuration:

```ts
import path from "path";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Categories } from "./collections/Categories";
import { Tags } from "./collections/Tags";

const plugins: any[] = [];

// Vercel Blob storage — only active when token is present (production)
if (process.env.BLOB_READ_WRITE_TOKEN) {
  plugins.push(
    vercelBlobStorage({
      collections: {
        media: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
  );
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(__dirname),
    },
  },
  collections: [Users, Media, Categories, Tags],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || "",
    },
  }),
  editor: lexicalEditor(),
  localization: {
    locales: [
      { label: "العربية", code: "ar" },
      { label: "Français", code: "fr" },
      { label: "English", code: "en" },
    ],
    defaultLocale: "ar",
    fallback: true,
  },
  plugins,
  secret: process.env.PAYLOAD_SECRET || "",
  sharp,
  typescript: {
    outputFile: path.resolve(__dirname, "payload-types.ts"),
  },
});
```

- [ ] **Step 6: Generate types and verify**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/admin`. After creating your first admin user:
1. Check that **Users**, **Media**, **Categories**, and **Tags** appear in the sidebar
2. Create a test category: name = "الدوري المغربي" (or "Botola"), slug = "botola"
3. Create a test tag: name = "المغرب", slug = "maroc"
4. Upload a test image to Media

Verify `src/payload-types.ts` was auto-generated with types for all collections.

- [ ] **Step 7: Commit**

```bash
git add src/collections/ src/payload.config.ts src/payload-types.ts
git commit -m "feat: add Users, Media, Categories, Tags collections with localization"
```

---

## Task 8: Root & Locale Layouts

**Files:**
- Create: `src/app/(frontend)/[locale]/layout.tsx`, `src/app/(frontend)/[locale]/page.tsx`
- Modify: `src/app/layout.tsx` (already modified in Task 4)

- [ ] **Step 1: Create locale layout with RTL/LTR switching**

Create `src/app/(frontend)/[locale]/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import { NextIntlClientProvider, useMessages } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";

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
    <div dir={direction} lang={locale} className={fontClass}>
      <NextIntlClientProvider messages={messages}>
        {children}
      </NextIntlClientProvider>
    </div>
  );
}
```

Note: We set `dir` and `lang` on a wrapper `<div>` rather than `<html>` to avoid hydration mismatches when navigating between locales. The root layout sets the fonts on `<body>`, and the locale layout switches direction.

- [ ] **Step 2: Create homepage placeholder**

Create `src/app/(frontend)/[locale]/page.tsx`:

```tsx
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-semibold text-primary">MFM Sport</h1>
        <p className="text-muted-foreground">
          {locale === "ar"
            ? "قريبا..."
            : locale === "fr"
              ? "Bientot..."
              : "Coming soon..."}
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify locale routing and direction**

```bash
pnpm dev
```

Test:
- `http://localhost:3000/ar/` — should show "MFM Sport" + "قريبا..." with RTL direction
- `http://localhost:3000/fr/` — should show "Bientot..." with LTR direction
- `http://localhost:3000/en/` — should show "Coming soon..." with LTR direction
- `http://localhost:3000/admin` — Payload admin should still work

- [ ] **Step 4: Commit**

```bash
git add src/app/
git commit -m "feat: add locale layout with RTL/LTR switching and homepage placeholder"
```

---

## Task 9: Header, Footer & Nav Components

**Files:**
- Create: `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`, `src/components/layout/Nav.tsx`, `src/components/layout/LanguageSwitcher.tsx`, `src/components/layout/MobileNav.tsx`
- Modify: `src/app/(frontend)/[locale]/layout.tsx`

- [ ] **Step 1: Create Nav component**

Create `src/components/layout/Nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

type Props = {
  locale: string;
  className?: string;
  onLinkClick?: () => void;
};

const navItems = [
  { key: "home", href: "" },
  { key: "news", href: "/articles" },
  { key: "competitions", href: "/competition" },
  { key: "matches", href: "/matches" },
  { key: "videos", href: "/videos" },
] as const;

export function Nav({ locale, className, onLinkClick }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className={className}>
      {navItems.map((item) => {
        const href = `/${locale}${item.href}`;
        const isActive =
          item.href === ""
            ? pathname === `/${locale}` || pathname === `/${locale}/`
            : pathname.startsWith(href);

        return (
          <Link
            key={item.key}
            href={href}
            onClick={onLinkClick}
            className={`text-sm font-medium transition-colors hover:text-primary ${
              isActive ? "text-primary" : "text-foreground/80"
            }`}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create LanguageSwitcher component**

Create `src/components/layout/LanguageSwitcher.tsx`:

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { routing, type Locale } from "@/i18n/routing";

const localeLabels: Record<Locale, string> = {
  ar: "عربي",
  fr: "FR",
  en: "EN",
};

type Props = {
  locale: string;
};

export function LanguageSwitcher({ locale }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(newLocale: Locale) {
    // Replace the current locale prefix in the pathname
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs font-medium">
          {localeLabels[locale as Locale] ?? locale.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className={loc === locale ? "bg-secondary" : ""}
          >
            {localeLabels[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Create MobileNav component**

Create `src/components/layout/MobileNav.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Nav } from "./Nav";

type Props = {
  locale: string;
};

export function MobileNav({ locale }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side={locale === "ar" ? "right" : "left"} className="w-64">
        <Nav
          locale={locale}
          className="flex flex-col gap-4 mt-8"
          onLinkClick={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Create Header component**

Create `src/components/layout/Header.tsx`:

```tsx
import Link from "next/link";
import { Nav } from "./Nav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";

type Props = {
  locale: string;
};

export function Header({ locale }: Props) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2"
        >
          <span className="text-xl font-bold text-primary">MFM</span>
          <span className="text-xl font-bold text-foreground">Sport</span>
        </Link>

        {/* Desktop nav */}
        <Nav locale={locale} className="hidden md:flex items-center gap-6" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          <MobileNav locale={locale} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Create Footer component**

Create `src/components/layout/Footer.tsx`:

```tsx
import Link from "next/link";
import { useTranslations } from "next-intl";

type Props = {
  locale: string;
};

const socialLinks = [
  { name: "Facebook", href: "https://facebook.com/mfmsport", icon: "FB" },
  { name: "Instagram", href: "https://instagram.com/mfmsport", icon: "IG" },
  { name: "X", href: "https://x.com/mfmsport", icon: "X" },
  { name: "YouTube", href: "https://youtube.com/mfmsport", icon: "YT" },
];

export function Footer({ locale }: Props) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link href={`/${locale}`} className="inline-block">
              <span className="text-xl font-bold text-primary">MFM</span>
              <span className="text-xl font-bold text-foreground"> Sport</span>
            </Link>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href={`/${locale}/about`} className="hover:text-foreground transition-colors">
              {locale === "ar" ? "من نحن" : locale === "fr" ? "A propos" : "About"}
            </Link>
            <Link href={`/${locale}/contact`} className="hover:text-foreground transition-colors">
              {locale === "ar" ? "اتصل بنا" : locale === "fr" ? "Contact" : "Contact"}
            </Link>
            <Link href={`/${locale}/legal`} className="hover:text-foreground transition-colors">
              {locale === "ar" ? "إشعار قانوني" : locale === "fr" ? "Mentions legales" : "Legal"}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-foreground transition-colors">
              {locale === "ar" ? "الخصوصية" : locale === "fr" ? "Confidentialite" : "Privacy"}
            </Link>
          </div>

          {/* Social */}
          <div className="flex gap-3">
            {socialLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors text-xs font-bold"
                aria-label={link.name}
              >
                {link.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          &copy; {currentYear} MFM Sport.{" "}
          {locale === "ar"
            ? "جميع الحقوق محفوظة"
            : locale === "fr"
              ? "Tous droits reserves"
              : "All rights reserved"}
          .
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 6: Wire Header and Footer into locale layout**

Update `src/app/(frontend)/[locale]/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

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
        <Header locale={locale} />
        <main className="flex-1">{children}</main>
        <Footer locale={locale} />
      </NextIntlClientProvider>
    </div>
  );
}
```

- [ ] **Step 7: Verify layout renders correctly**

```bash
pnpm dev
```

Test all 3 locales:
- `http://localhost:3000/ar/` — Header with Arabic nav (right-to-left), Footer with Arabic text, "MFM Sport" logo in red
- `http://localhost:3000/fr/` — Header with French nav (left-to-right), Footer with French text
- `http://localhost:3000/en/` — Header with English nav, Footer with English text
- Language switcher works (click dropdown, select different locale)
- Mobile: resize to <768px, hamburger menu appears, sheet opens from correct side (right for AR, left for FR/EN)

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/ src/app/\(frontend\)/
git commit -m "feat: add Header, Footer, Nav, LanguageSwitcher with RTL support"
```

---

## Task 10: Testing Infrastructure & Verification

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`
- Create: `src/components/layout/__tests__/Header.test.tsx`

- [ ] **Step 1: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 2: Create test setup**

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add test script to package.json**

Add to the `"scripts"` section of `package.json`:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 4: Write Header smoke test**

Create `src/components/layout/__tests__/Header.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Header } from "../Header";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/ar/",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Header", () => {
  it("renders the MFM Sport logo", () => {
    render(<Header locale="ar" />);
    expect(screen.getByText("MFM")).toBeInTheDocument();
    expect(screen.getByText("Sport")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<Header locale="ar" />);
    const links = screen.getAllByRole("link");
    // Logo link + 5 nav links = at least 6
    expect(links.length).toBeGreaterThanOrEqual(6);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm test:run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/test/ src/components/layout/__tests__/ package.json
git commit -m "feat: add Vitest testing infrastructure with Header smoke test"
```

---

## Task 11: Sentry & Vercel Analytics

**Files:**
- Install: `@sentry/nextjs`, `@vercel/analytics`
- Create: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

- [ ] **Step 1: Install Sentry and Vercel Analytics**

```bash
pnpm add @sentry/nextjs @vercel/analytics @vercel/speed-insights
```

- [ ] **Step 2: Create Sentry client config**

Create `sentry.client.config.ts` at project root:

```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  enabled: process.env.NODE_ENV === "production",
});
```

- [ ] **Step 3: Create Sentry server config**

Create `sentry.server.config.ts` at project root:

```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
```

- [ ] **Step 4: Create Sentry edge config**

Create `sentry.edge.config.ts` at project root:

```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
```

- [ ] **Step 5: Add Analytics to root layout**

Update `src/app/layout.tsx` — add the analytics components inside `<body>`:

```tsx
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// ... existing imports and font config ...

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body
        className={`${plexSans.variable} ${plexArabic.variable} font-sans antialiased`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Update .env.example**

Add to `.env.example`:

```env
NEXT_PUBLIC_SENTRY_DSN=
```

- [ ] **Step 7: Commit**

```bash
git add sentry.*.config.ts src/app/layout.tsx .env.example package.json pnpm-lock.yaml
git commit -m "feat: add Sentry error tracking and Vercel Analytics"
```

---

## Task 12: Placeholder Logo & Final Verification

**Files:**
- Create: `public/images/logo.svg`

- [ ] **Step 1: Create placeholder SVG logo**

Create `public/images/logo.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" fill="none">
  <text x="0" y="30" font-family="sans-serif" font-weight="700" font-size="28" fill="#D92332">MFM</text>
  <text x="72" y="30" font-family="sans-serif" font-weight="700" font-size="28" fill="#F5F5F5">Sport</text>
</svg>
```

- [ ] **Step 2: Full verification checklist**

Start the dev server:

```bash
pnpm dev
```

Verify each item:

| Check | URL | Expected |
|-------|-----|----------|
| Arabic homepage | `/ar/` | Dark bg, RTL, Arabic font, Header + Footer |
| French homepage | `/fr/` | Dark bg, LTR, Latin font, French nav text |
| English homepage | `/en/` | Dark bg, LTR, Latin font, English nav text |
| Language switch | Click switcher | URL changes locale prefix, direction flips |
| Mobile nav | Resize < 768px | Hamburger icon appears, sheet opens |
| Payload admin | `/admin` | Login screen or dashboard (no locale prefix) |
| Media upload | Admin → Media → Create | Can upload an image, alt field is localized |
| Categories | Admin → Categories → Create | Name is localized, slug field, parent dropdown works |
| Tags | Admin → Tags → Create | Name is localized, slug field |
| MFM Sport red | Everywhere | Logo, active nav, badges use `#D92332` |
| Near-black bg | Everywhere | Background is `#0E0E10` |
| Fonts | DevTools → Network | IBM Plex Sans Arabic + IBM Plex Sans loaded |
| Tests | `pnpm test:run` | All tests pass |

- [ ] **Step 3: Final commit**

```bash
git add public/images/
git commit -m "feat: add placeholder logo and complete foundation setup"
```

---

## Self-Review Notes

**Spec coverage:** This plan covers all foundation requirements from PROJECT_MEMORY.md sections 8 (tech stack), 9 (design), 17 (i18n), and 18 (collections: users, media, categories, tags). Remaining collections (articles, authors, clubs, competitions, subscribers, redirects) are deferred to Plans 2-5.

**What this plan produces:** A running Next.js 15 + Payload 3.0 app that an editor can log into, with a dark Moroccan-themed layout shell that switches between Arabic (RTL) and French/English (LTR), and four foundational CMS collections ready for content.

**What comes next:** Plan 2 (Editorial Pages) adds the `articles` and `authors` collections, then builds the homepage, article list, single article, category archive, tag archive, author profile, and search pages — the core reading experience.

---

*Plan written 2026-04-20. Ready for execution.*
