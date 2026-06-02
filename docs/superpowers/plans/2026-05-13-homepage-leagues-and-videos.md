# Homepage Leagues & Videos Restructure Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage's two stacked 3×2 news grids ("Top News" + "Latest News") with two new sections that mirror the existing `HeroSection` split-layout pattern: (1) a league-filtered news section showing a 2×2 article grid alongside a clickable list of championships, and (2) a videos section showing a featured video player alongside a scrollable list of more videos. Both new sections use mock data; the real backend wiring (league selection, YouTube API) lands in a later phase.

**Architecture:** Each new section is a client component (`LeagueNewsSection`, `VideosSection`) that owns selection state and composes two pure-UI children, mirroring `HeroSection`'s grid (`grid-cols-1 lg:grid-cols-3`, `col-span-2` for the big half, `col-span-1` for the smaller half, equal `lg:h-[500px]`). The smaller half (panel) is rendered second in DOM order so RTL locales naturally flip it to the visual left, matching the established `HeroSection` + `MatchesPanel` pattern. Mock data lives in `src/lib/home/` as plain TS modules with locale-keyed strings; the structure mirrors `ApiFixture`-style domain objects so a future real-data swap is mechanical.

**Tech Stack:** Next.js 16 App Router, React 19 client components, Tailwind CSS, `next-intl` for translations, `next/image`, `lucide-react` (`ChevronDown`, `Play`), Vitest + `@testing-library/react` for tests.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/lib/home/mockLeagueNews.ts` | Mock leagues + per-league articles, locale-keyed titles |
| Create | `src/lib/home/mockVideos.ts` | Mock YouTube videos (id, title, thumb, duration, publishedAt) |
| Create | `src/components/home/LeaguesPanel.tsx` | Pure UI: vertical list of league buttons with active state |
| Create | `src/components/home/NewsGrid2x2.tsx` | Pure UI: 2×2 grid of article cards from mock data |
| Create | `src/components/home/LeagueNewsSection.tsx` | Client: owns `selectedLeagueId`, composes Panel + Grid in 1/3 + 2/3 layout |
| Create | `src/components/home/VideoList.tsx` | Pure UI: scrollable vertical list of video thumb rows with active state |
| Create | `src/components/home/VideoPlayer.tsx` | Pure UI: 16:9 YouTube iframe embed |
| Create | `src/components/home/VideosSection.tsx` | Client: owns `selectedVideoId`, composes Player + List in 1/3 + 2/3 layout |
| Create | `src/components/home/__tests__/LeaguesPanel.test.tsx` | Unit tests |
| Create | `src/components/home/__tests__/NewsGrid2x2.test.tsx` | Unit tests |
| Create | `src/components/home/__tests__/LeagueNewsSection.test.tsx` | Integration tests |
| Create | `src/components/home/__tests__/VideoList.test.tsx` | Unit tests |
| Create | `src/components/home/__tests__/VideoPlayer.test.tsx` | Unit tests |
| Create | `src/components/home/__tests__/VideosSection.test.tsx` | Integration tests |
| Modify | `src/app/(frontend)/[locale]/page.tsx` | Drop both `NewsSection` calls; render `LeagueNewsSection` + `VideosSection`; drop now-unused slicing |
| Modify | `messages/en.json` | Add `home.byLeague`, `home.allLeagues`, `home.latestVideos` |
| Modify | `messages/ar.json` | Same keys, Arabic copy |
| Modify | `messages/fr.json` | Same keys, French copy |

`src/components/home/NewsSection.tsx` is kept untouched (used elsewhere if needed; YAGNI-safe to leave).

---

## Current layout (reference)

```
[HeroSection: big article (col-span-2)  | MatchesPanel (col-span-1)]   <-- unchanged
[NewsSection "topNews" — 3×2 ArticleGrid (6 cards)]                    <-- REMOVED
[NewsSection "latestNews" — 3×2 ArticleGrid (6 cards)]                 <-- REMOVED
[NewsletterStrip]
```

## Target layout

```
[HeroSection: big article (col-span-2)  | MatchesPanel (col-span-1)]   <-- unchanged
[LeagueNewsSection: NewsGrid2x2 (col-span-2)  | LeaguesPanel (col-span-1)]
[VideosSection:    VideoPlayer  (col-span-2)  | VideoList    (col-span-1)]
[NewsletterStrip]
```

Both new sections share `HeroSection`'s exact grid classes: `grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[500px]`, with a `mt-10` top margin matching existing section spacing.

---

## Mock data shape (defined once, referenced by every task)

```ts
// src/lib/home/mockLeagueNews.ts
export type MockLocaleString = { en: string; ar: string; fr: string };

export type MockLeague = {
  id: string;          // stable slug, used as React key + selection identifier
  name: MockLocaleString;
  logoUrl: string;     // remote URL or /public path
};

export type MockLeagueArticle = {
  id: string;
  leagueId: string;    // FK to MockLeague.id
  title: MockLocaleString;
  slug: string;        // used for href: /{locale}/articles/{slug}
  imageUrl: string;
  category: MockLocaleString;
  publishedAt: string; // ISO date
};

export const MOCK_LEAGUES: MockLeague[];
export const MOCK_LEAGUE_ARTICLES: MockLeagueArticle[];
export function getArticlesForLeague(leagueId: string): MockLeagueArticle[]; // returns ≤4 articles
```

```ts
// src/lib/home/mockVideos.ts
import type { MockLocaleString } from "./mockLeagueNews";

export type MockVideo = {
  id: string;            // YouTube video ID (used in embed URL)
  title: MockLocaleString;
  thumbnailUrl: string;  // YouTube thumbnail URL
  duration: string;      // "MM:SS"
  publishedAt: string;   // ISO date
};

export const MOCK_VIDEOS: MockVideo[];
```

---

### Task 1: Mock league-news data module

**Files:**
- Create: `src/lib/home/mockLeagueNews.ts`

- [ ] **Step 1: Write the module**

```ts
export type MockLocaleString = { en: string; ar: string; fr: string };

export type MockLeague = {
  id: string;
  name: MockLocaleString;
  logoUrl: string;
};

export type MockLeagueArticle = {
  id: string;
  leagueId: string;
  title: MockLocaleString;
  slug: string;
  imageUrl: string;
  category: MockLocaleString;
  publishedAt: string;
};

export const MOCK_LEAGUES: MockLeague[] = [
  {
    id: "botola-pro",
    name: { en: "Botola Pro", ar: "البطولة الاحترافية", fr: "Botola Pro" },
    logoUrl: "https://media.api-sports.io/football/leagues/200.png",
  },
  {
    id: "champions-league",
    name: { en: "Champions League", ar: "دوري أبطال أوروبا", fr: "Ligue des champions" },
    logoUrl: "https://media.api-sports.io/football/leagues/2.png",
  },
  {
    id: "premier-league",
    name: { en: "Premier League", ar: "الدوري الإنجليزي", fr: "Premier League" },
    logoUrl: "https://media.api-sports.io/football/leagues/39.png",
  },
  {
    id: "la-liga",
    name: { en: "La Liga", ar: "الدوري الإسباني", fr: "La Liga" },
    logoUrl: "https://media.api-sports.io/football/leagues/140.png",
  },
  {
    id: "serie-a",
    name: { en: "Serie A", ar: "الدوري الإيطالي", fr: "Serie A" },
    logoUrl: "https://media.api-sports.io/football/leagues/135.png",
  },
  {
    id: "ligue-1",
    name: { en: "Ligue 1", ar: "الدوري الفرنسي", fr: "Ligue 1" },
    logoUrl: "https://media.api-sports.io/football/leagues/61.png",
  },
];

function makeArticle(
  leagueId: string,
  index: number,
  base: { en: string; ar: string; fr: string },
  category: { en: string; ar: string; fr: string },
  daysAgo: number,
): MockLeagueArticle {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id: `${leagueId}-${index}`,
    leagueId,
    title: base,
    slug: `${leagueId}-article-${index}`,
    imageUrl: `https://picsum.photos/seed/${leagueId}-${index}/640/360`,
    category,
    publishedAt: date.toISOString(),
  };
}

export const MOCK_LEAGUE_ARTICLES: MockLeagueArticle[] = [
  // Botola Pro
  makeArticle("botola-pro", 1, { en: "Raja secure derby victory over Wydad", ar: "الرجاء يحقق فوزا في الديربي على الوداد", fr: "Le Raja remporte le derby face au Wydad" }, { en: "Botola", ar: "البطولة", fr: "Botola" }, 0),
  makeArticle("botola-pro", 2, { en: "AS FAR climb to top of Botola standings", ar: "الجيش الملكي يتصدر ترتيب البطولة", fr: "L'AS FAR prend la tête du classement" }, { en: "Botola", ar: "البطولة", fr: "Botola" }, 1),
  makeArticle("botola-pro", 3, { en: "RS Berkane lift Confederation Cup again", ar: "نهضة بركان تتوج بكأس الكاف من جديد", fr: "La RS Berkane remporte à nouveau la Coupe de la CAF" }, { en: "Continental", ar: "قاري", fr: "Continental" }, 2),
  makeArticle("botola-pro", 4, { en: "Moroccan U23 squad announced for friendlies", ar: "الإعلان عن لائحة المنتخب الأولمبي للمباريات الودية", fr: "Liste des U23 marocains pour les amicaux dévoilée" }, { en: "National Team", ar: "المنتخب", fr: "Sélection" }, 3),

  // Champions League
  makeArticle("champions-league", 1, { en: "Real Madrid edge Bayern in semi-final thriller", ar: "ريال مدريد يتجاوز بايرن في إثارة نصف النهائي", fr: "Real Madrid bat le Bayern dans un demi-finale haletante" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, 0),
  makeArticle("champions-league", 2, { en: "Man City through after dramatic comeback", ar: "مانشستر سيتي يتأهل بعد عودة درامية", fr: "Manchester City se qualifie après une remontée dramatique" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, 1),
  makeArticle("champions-league", 3, { en: "Champions League final venue confirmed", ar: "تأكيد ملعب نهائي دوري الأبطال", fr: "Le stade de la finale de la LDC confirmé" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, 2),
  makeArticle("champions-league", 4, { en: "Hakimi's PSG eliminated in quarters", ar: "إقصاء حكيمي وباريس في ربع النهائي", fr: "Hakimi et le PSG éliminés en quarts" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, 3),

  // Premier League
  makeArticle("premier-league", 1, { en: "Arsenal close gap at the top of the table", ar: "أرسنال يقلص الفارق في الصدارة", fr: "Arsenal réduit l'écart en tête du classement" }, { en: "PL", ar: "البريميرليغ", fr: "PL" }, 0),
  makeArticle("premier-league", 2, { en: "Liverpool clinch derby win at Anfield", ar: "ليفربول يحقق فوز الديربي في أنفيلد", fr: "Liverpool remporte le derby à Anfield" }, { en: "PL", ar: "البريميرليغ", fr: "PL" }, 1),
  makeArticle("premier-league", 3, { en: "Ziyech rumoured to make Premier League return", ar: "أنباء عن عودة زياش إلى البريميرليغ", fr: "Ziyech vers un retour en Premier League" }, { en: "Transfers", ar: "انتقالات", fr: "Transferts" }, 2),
  makeArticle("premier-league", 4, { en: "Title race goes to the final matchday", ar: "صراع اللقب يحسم في الجولة الأخيرة", fr: "La course au titre se jouera lors de la dernière journée" }, { en: "PL", ar: "البريميرليغ", fr: "PL" }, 3),

  // La Liga
  makeArticle("la-liga", 1, { en: "Real Madrid crowned La Liga champions", ar: "ريال مدريد بطلا للدوري الإسباني", fr: "Le Real Madrid sacré champion de La Liga" }, { en: "La Liga", ar: "الليغا", fr: "Liga" }, 0),
  makeArticle("la-liga", 2, { en: "Barcelona youngster signs new long-term deal", ar: "موهبة برشلونة توقع عقدا طويل الأمد", fr: "Le jeune barcelonais prolonge son contrat" }, { en: "Transfers", ar: "انتقالات", fr: "Transferts" }, 1),
  makeArticle("la-liga", 3, { en: "Atletico clinch Champions League spot", ar: "أتلتيكو يضمن مقعدا في دوري الأبطال", fr: "L'Atlético décroche son ticket pour la LDC" }, { en: "La Liga", ar: "الليغا", fr: "Liga" }, 2),
  makeArticle("la-liga", 4, { en: "Sevilla appoint new head coach", ar: "إشبيلية يعين مدربا جديدا", fr: "Séville nomme un nouvel entraîneur" }, { en: "La Liga", ar: "الليغا", fr: "Liga" }, 3),

  // Serie A
  makeArticle("serie-a", 1, { en: "Inter retain Scudetto with games to spare", ar: "إنتر يحتفظ بالسكوديتو قبل نهاية الموسم", fr: "L'Inter conserve le Scudetto avant la fin de saison" }, { en: "Serie A", ar: "السيري آ", fr: "Serie A" }, 0),
  makeArticle("serie-a", 2, { en: "Juventus rebuild continues with new signings", ar: "يوفنتوس يواصل إعادة البناء بصفقات جديدة", fr: "La Juventus poursuit sa reconstruction avec de nouvelles recrues" }, { en: "Transfers", ar: "انتقالات", fr: "Transferts" }, 1),
  makeArticle("serie-a", 3, { en: "Napoli search for next coach", ar: "نابولي يبحث عن مدرب جديد", fr: "Naples cherche son prochain entraîneur" }, { en: "Serie A", ar: "السيري آ", fr: "Serie A" }, 2),
  makeArticle("serie-a", 4, { en: "Milan derby ends in dramatic draw", ar: "ديربي ميلانو ينتهي بتعادل مثير", fr: "Le derby de Milan se termine sur un nul dramatique" }, { en: "Serie A", ar: "السيري آ", fr: "Serie A" }, 3),

  // Ligue 1
  makeArticle("ligue-1", 1, { en: "PSG seal another Ligue 1 title", ar: "باريس يحسم لقب الليغ آن مجددا", fr: "Le PSG décroche un nouveau titre de Ligue 1" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, 0),
  makeArticle("ligue-1", 2, { en: "Monaco confirm European football return", ar: "موناكو يؤكد العودة إلى المسابقات الأوروبية", fr: "Monaco confirme son retour en coupe d'Europe" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, 1),
  makeArticle("ligue-1", 3, { en: "Marseille hire new sporting director", ar: "مارسيليا يعين مديرا رياضيا جديدا", fr: "Marseille recrute un nouveau directeur sportif" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, 2),
  makeArticle("ligue-1", 4, { en: "Lyon clinch final European spot", ar: "ليون يخطف آخر مقعد أوروبي", fr: "Lyon arrache la dernière place européenne" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, 3),
];

export function getArticlesForLeague(leagueId: string): MockLeagueArticle[] {
  return MOCK_LEAGUE_ARTICLES.filter((a) => a.leagueId === leagueId).slice(0, 4);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/home/mockLeagueNews.ts
git commit -m "feat(home): add mock league-news data module"
```

---

### Task 2: Mock videos data module

**Files:**
- Create: `src/lib/home/mockVideos.ts`

- [ ] **Step 1: Write the module**

```ts
import type { MockLocaleString } from "./mockLeagueNews";

export type MockVideo = {
  id: string;
  title: MockLocaleString;
  thumbnailUrl: string;
  duration: string;
  publishedAt: string;
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const MOCK_VIDEOS: MockVideo[] = [
  {
    id: "dQw4w9WgXcQ",
    title: {
      en: "Match highlights: Raja vs Wydad",
      ar: "ملخص مباراة: الرجاء ضد الوداد",
      fr: "Résumé du match : Raja vs Wydad",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    duration: "10:24",
    publishedAt: daysAgo(0),
  },
  {
    id: "9bZkp7q19f0",
    title: {
      en: "Top 10 goals of the week",
      ar: "أفضل 10 أهداف هذا الأسبوع",
      fr: "Top 10 des buts de la semaine",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
    duration: "08:12",
    publishedAt: daysAgo(1),
  },
  {
    id: "kJQP7kiw5Fk",
    title: {
      en: "Post-match interview: AS FAR coach",
      ar: "تصريحات ما بعد المباراة: مدرب الجيش الملكي",
      fr: "Interview d'après-match : entraîneur de l'AS FAR",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
    duration: "05:45",
    publishedAt: daysAgo(2),
  },
  {
    id: "L_jWHffIx5E",
    title: {
      en: "Champions League: best saves",
      ar: "دوري الأبطال: أفضل التصديات",
      fr: "Ligue des champions : meilleurs arrêts",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/L_jWHffIx5E/hqdefault.jpg",
    duration: "07:33",
    publishedAt: daysAgo(2),
  },
  {
    id: "fJ9rUzIMcZQ",
    title: {
      en: "Tactical breakdown: Atlas Lions formation",
      ar: "تحليل تكتيكي: تشكيلة أسود الأطلس",
      fr: "Analyse tactique : la formation des Lions de l'Atlas",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
    duration: "12:01",
    publishedAt: daysAgo(3),
  },
  {
    id: "OPf0YbXqDm0",
    title: {
      en: "Hakimi: career moments",
      ar: "حكيمي: لحظات من المسيرة",
      fr: "Hakimi : moments de carrière",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg",
    duration: "09:18",
    publishedAt: daysAgo(4),
  },
  {
    id: "RgKAFK5djSk",
    title: {
      en: "Botola weekly recap",
      ar: "ملخص أسبوع البطولة",
      fr: "Résumé hebdomadaire de la Botola",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg",
    duration: "11:42",
    publishedAt: daysAgo(5),
  },
  {
    id: "JGwWNGJdvx8",
    title: {
      en: "Press conference: national team manager",
      ar: "ندوة صحفية: مدرب المنتخب",
      fr: "Conférence de presse : sélectionneur national",
    },
    thumbnailUrl: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
    duration: "06:27",
    publishedAt: daysAgo(6),
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/home/mockVideos.ts
git commit -m "feat(home): add mock videos data module"
```

---

### Task 3: `LeaguesPanel` component (UI primitive)

**Files:**
- Create: `src/components/home/LeaguesPanel.tsx`
- Create: `src/components/home/__tests__/LeaguesPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/home/__tests__/LeaguesPanel.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeaguesPanel } from "@/components/home/LeaguesPanel";
import type { MockLeague } from "@/lib/home/mockLeagueNews";

const leagues: MockLeague[] = [
  { id: "a", name: { en: "Alpha", ar: "ألفا", fr: "Alpha" }, logoUrl: "/a.png" },
  { id: "b", name: { en: "Beta", ar: "بيتا", fr: "Beta" }, logoUrl: "/b.png" },
];

describe("LeaguesPanel", () => {
  it("renders one button per league with localized name", () => {
    render(
      <LeaguesPanel leagues={leagues} selectedId="a" locale="en" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Beta/ })).toBeInTheDocument();
  });

  it("marks the selected league with aria-pressed=true", () => {
    render(
      <LeaguesPanel leagues={leagues} selectedId="b" locale="en" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /Beta/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the league id when clicked", () => {
    const onSelect = vi.fn();
    render(
      <LeaguesPanel leagues={leagues} selectedId="a" locale="en" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Beta/ }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("displays Arabic names when locale=ar", () => {
    render(
      <LeaguesPanel leagues={leagues} selectedId="a" locale="ar" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /ألفا/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/__tests__/LeaguesPanel.test.tsx`
Expected: FAIL with "Cannot find module '@/components/home/LeaguesPanel'".

- [ ] **Step 3: Write the component**

```tsx
// src/components/home/LeaguesPanel.tsx
"use client";

import Image from "next/image";
import type { MockLeague } from "@/lib/home/mockLeagueNews";

type Props = {
  leagues: MockLeague[];
  selectedId: string;
  locale: string;
  onSelect: (leagueId: string) => void;
};

function pickName(league: MockLeague, locale: string): string {
  if (locale === "ar") return league.name.ar;
  if (locale === "fr") return league.name.fr;
  return league.name.en;
}

export function LeaguesPanel({ leagues, selectedId, locale, onSelect }: Props) {
  return (
    <div className="flex h-full flex-col gap-1.5 overflow-y-auto rounded-xl border border-border bg-card p-2">
      {leagues.map((league) => {
        const isActive = league.id === selectedId;
        return (
          <button
            key={league.id}
            type="button"
            onClick={() => onSelect(league.id)}
            aria-pressed={isActive}
            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-start text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-foreground hover:bg-muted"
            }`}
          >
            <Image
              src={league.logoUrl}
              alt=""
              width={20}
              height={20}
              className="shrink-0"
            />
            <span className="flex-1 truncate">{pickName(league, locale)}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/__tests__/LeaguesPanel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/LeaguesPanel.tsx src/components/home/__tests__/LeaguesPanel.test.tsx
git commit -m "feat(home): add LeaguesPanel component for league selection"
```

---

### Task 4: `NewsGrid2x2` component (UI primitive)

**Files:**
- Create: `src/components/home/NewsGrid2x2.tsx`
- Create: `src/components/home/__tests__/NewsGrid2x2.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/home/__tests__/NewsGrid2x2.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewsGrid2x2 } from "@/components/home/NewsGrid2x2";
import type { MockLeagueArticle } from "@/lib/home/mockLeagueNews";

function makeArticle(i: number): MockLeagueArticle {
  return {
    id: `id-${i}`,
    leagueId: "x",
    title: { en: `Title ${i}`, ar: `العنوان ${i}`, fr: `Titre ${i}` },
    slug: `slug-${i}`,
    imageUrl: `https://example.com/${i}.jpg`,
    category: { en: "Cat", ar: "فئة", fr: "Cat" },
    publishedAt: "2026-05-13T12:00:00.000Z",
  };
}

describe("NewsGrid2x2", () => {
  it("renders all provided article titles (English)", () => {
    const articles = [1, 2, 3, 4].map(makeArticle);
    render(<NewsGrid2x2 articles={articles} locale="en" />);
    expect(screen.getByText("Title 1")).toBeInTheDocument();
    expect(screen.getByText("Title 2")).toBeInTheDocument();
    expect(screen.getByText("Title 3")).toBeInTheDocument();
    expect(screen.getByText("Title 4")).toBeInTheDocument();
  });

  it("links each card to /{locale}/articles/{slug}", () => {
    const articles = [makeArticle(1)];
    render(<NewsGrid2x2 articles={articles} locale="fr" />);
    const link = screen.getByRole("link", { name: /Titre 1/ });
    expect(link).toHaveAttribute("href", "/fr/articles/slug-1");
  });

  it("uses Arabic title when locale=ar", () => {
    const articles = [makeArticle(1)];
    render(<NewsGrid2x2 articles={articles} locale="ar" />);
    expect(screen.getByText("العنوان 1")).toBeInTheDocument();
  });

  it("renders empty grid gracefully when no articles", () => {
    const { container } = render(<NewsGrid2x2 articles={[]} locale="en" />);
    expect(container.querySelectorAll("article")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/__tests__/NewsGrid2x2.test.tsx`
Expected: FAIL with "Cannot find module '@/components/home/NewsGrid2x2'".

- [ ] **Step 3: Write the component**

```tsx
// src/components/home/NewsGrid2x2.tsx
import Image from "next/image";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { MockLeagueArticle } from "@/lib/home/mockLeagueNews";

type Props = {
  articles: MockLeagueArticle[];
  locale: string;
};

function pickLocalized(s: { en: string; ar: string; fr: string }, locale: string): string {
  if (locale === "ar") return s.ar;
  if (locale === "fr") return s.fr;
  return s.en;
}

export function NewsGrid2x2({ articles, locale }: Props) {
  return (
    <div className="grid h-full grid-cols-1 gap-3 sm:grid-cols-2 sm:grid-rows-2">
      {articles.map((article) => (
        <article
          key={article.id}
          className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30"
        >
          <div className="relative aspect-video overflow-hidden">
            <Image
              src={article.imageUrl}
              alt={pickLocalized(article.title, locale)}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 1024px) 100vw, 33vw"
            />
            <div className="absolute bottom-2 start-2 z-10 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
              {pickLocalized(article.category, locale)}
            </div>
          </div>
          <div className="flex flex-1 flex-col p-3">
            <h3 className="text-sm font-semibold leading-tight line-clamp-2 transition-colors group-hover:text-primary">
              <Link
                href={`/${locale}/articles/${article.slug}`}
                className="after:absolute after:inset-0 after:content-['']"
              >
                {pickLocalized(article.title, locale)}
              </Link>
            </h3>
            <time
              dateTime={article.publishedAt}
              className="mt-auto pt-2 text-xs text-muted-foreground"
            >
              {formatDate(article.publishedAt, locale)}
            </time>
          </div>
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/__tests__/NewsGrid2x2.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/NewsGrid2x2.tsx src/components/home/__tests__/NewsGrid2x2.test.tsx
git commit -m "feat(home): add NewsGrid2x2 component for league article cards"
```

---

### Task 5: `LeagueNewsSection` component (stateful composer)

**Files:**
- Create: `src/components/home/LeagueNewsSection.tsx`
- Create: `src/components/home/__tests__/LeagueNewsSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/home/__tests__/LeagueNewsSection.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeagueNewsSection } from "@/components/home/LeagueNewsSection";

describe("LeagueNewsSection", () => {
  it("defaults to the first league and shows its 4 articles", () => {
    render(
      <LeagueNewsSection
        title="By League"
        locale="en"
      />,
    );
    expect(screen.getByRole("heading", { name: "By League" })).toBeInTheDocument();
    // First league is "Botola Pro" — should be active
    expect(screen.getByRole("button", { name: /Botola Pro/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // 4 article cards visible
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });

  it("switches articles when a different league is clicked", () => {
    render(<LeagueNewsSection title="By League" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: /Premier League/ }));
    expect(screen.getByRole("button", { name: /Premier League/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Botola Pro/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // Should still show 4 articles, but with PL titles
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(4);
    expect(screen.getByText(/Arsenal close gap/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/__tests__/LeagueNewsSection.test.tsx`
Expected: FAIL with "Cannot find module '@/components/home/LeagueNewsSection'".

- [ ] **Step 3: Write the component**

```tsx
// src/components/home/LeagueNewsSection.tsx
"use client";

import { useMemo, useState } from "react";
import { LeaguesPanel } from "./LeaguesPanel";
import { NewsGrid2x2 } from "./NewsGrid2x2";
import {
  MOCK_LEAGUES,
  getArticlesForLeague,
} from "@/lib/home/mockLeagueNews";

type Props = {
  title: string;
  locale: string;
};

export function LeagueNewsSection({ title, locale }: Props) {
  const [selectedId, setSelectedId] = useState<string>(MOCK_LEAGUES[0]?.id ?? "");

  const articles = useMemo(
    () => getArticlesForLeague(selectedId),
    [selectedId],
  );

  return (
    <section className="mt-10">
      <h2 className="relative mb-4 text-xl font-bold">
        {title}
        <span className="absolute -bottom-1 start-0 h-0.5 w-12 bg-primary" />
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:h-[500px] lg:grid-cols-3">
        <div className="lg:col-span-2 lg:h-full">
          <NewsGrid2x2 articles={articles} locale={locale} />
        </div>
        <div className="lg:h-full">
          <LeaguesPanel
            leagues={MOCK_LEAGUES}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/__tests__/LeagueNewsSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/LeagueNewsSection.tsx src/components/home/__tests__/LeagueNewsSection.test.tsx
git commit -m "feat(home): add LeagueNewsSection composing panel and 2x2 grid"
```

---

### Task 6: `VideoList` component (UI primitive)

**Files:**
- Create: `src/components/home/VideoList.tsx`
- Create: `src/components/home/__tests__/VideoList.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/home/__tests__/VideoList.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoList } from "@/components/home/VideoList";
import type { MockVideo } from "@/lib/home/mockVideos";

const videos: MockVideo[] = [
  {
    id: "vid1",
    title: { en: "First", ar: "الأول", fr: "Premier" },
    thumbnailUrl: "https://example.com/1.jpg",
    duration: "01:23",
    publishedAt: "2026-05-13T12:00:00.000Z",
  },
  {
    id: "vid2",
    title: { en: "Second", ar: "الثاني", fr: "Deuxième" },
    thumbnailUrl: "https://example.com/2.jpg",
    duration: "04:56",
    publishedAt: "2026-05-12T12:00:00.000Z",
  },
];

describe("VideoList", () => {
  it("renders one button per video with localized title and duration", () => {
    render(
      <VideoList videos={videos} selectedId="vid1" locale="en" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /First/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Second/ })).toBeInTheDocument();
    expect(screen.getByText("01:23")).toBeInTheDocument();
    expect(screen.getByText("04:56")).toBeInTheDocument();
  });

  it("marks the selected video with aria-pressed=true", () => {
    render(
      <VideoList videos={videos} selectedId="vid2" locale="en" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /Second/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /First/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the video id when clicked", () => {
    const onSelect = vi.fn();
    render(
      <VideoList videos={videos} selectedId="vid1" locale="en" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Second/ }));
    expect(onSelect).toHaveBeenCalledWith("vid2");
  });

  it("uses Arabic title when locale=ar", () => {
    render(
      <VideoList videos={videos} selectedId="vid1" locale="ar" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /الأول/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/__tests__/VideoList.test.tsx`
Expected: FAIL with "Cannot find module '@/components/home/VideoList'".

- [ ] **Step 3: Write the component**

```tsx
// src/components/home/VideoList.tsx
"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { MockVideo } from "@/lib/home/mockVideos";

type Props = {
  videos: MockVideo[];
  selectedId: string;
  locale: string;
  onSelect: (videoId: string) => void;
};

function pickTitle(video: MockVideo, locale: string): string {
  if (locale === "ar") return video.title.ar;
  if (locale === "fr") return video.title.fr;
  return video.title.en;
}

export function VideoList({ videos, selectedId, locale, onSelect }: Props) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-card p-2">
      {videos.map((video) => {
        const isActive = video.id === selectedId;
        return (
          <button
            key={video.id}
            type="button"
            onClick={() => onSelect(video.id)}
            aria-pressed={isActive}
            className={`flex items-stretch gap-2 rounded-lg p-1.5 text-start transition-colors ${
              isActive
                ? "bg-primary/10 ring-1 ring-primary"
                : "hover:bg-muted/40"
            }`}
          >
            <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md">
              <Image
                src={video.thumbnailUrl}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
              />
              {isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-5 w-5 text-white" fill="white" />
                </div>
              )}
              <span className="absolute bottom-0.5 end-0.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                {video.duration}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-between py-0.5">
              <span className="text-xs font-medium leading-snug line-clamp-2">
                {pickTitle(video, locale)}
              </span>
              <time
                dateTime={video.publishedAt}
                className="text-[10px] text-muted-foreground"
              >
                {formatDate(video.publishedAt, locale)}
              </time>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/__tests__/VideoList.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/VideoList.tsx src/components/home/__tests__/VideoList.test.tsx
git commit -m "feat(home): add VideoList component for selecting videos"
```

---

### Task 7: `VideoPlayer` component (UI primitive)

**Files:**
- Create: `src/components/home/VideoPlayer.tsx`
- Create: `src/components/home/__tests__/VideoPlayer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/home/__tests__/VideoPlayer.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoPlayer } from "@/components/home/VideoPlayer";

describe("VideoPlayer", () => {
  it("renders a YouTube iframe with the correct video id in src", () => {
    render(<VideoPlayer videoId="abc123" title="My Title" />);
    const iframe = screen.getByTitle("My Title") as HTMLIFrameElement;
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.src).toContain("youtube.com/embed/abc123");
  });

  it("sets allowfullscreen on the iframe", () => {
    render(<VideoPlayer videoId="abc123" title="My Title" />);
    const iframe = screen.getByTitle("My Title");
    expect(iframe).toHaveAttribute("allowfullscreen");
  });

  it("updates the iframe src when videoId changes", () => {
    const { rerender } = render(<VideoPlayer videoId="abc123" title="t" />);
    rerender(<VideoPlayer videoId="xyz999" title="t" />);
    const iframe = screen.getByTitle("t") as HTMLIFrameElement;
    expect(iframe.src).toContain("youtube.com/embed/xyz999");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/__tests__/VideoPlayer.test.tsx`
Expected: FAIL with "Cannot find module '@/components/home/VideoPlayer'".

- [ ] **Step 3: Write the component**

```tsx
// src/components/home/VideoPlayer.tsx
type Props = {
  videoId: string;
  title: string;
};

export function VideoPlayer({ videoId, title }: Props) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
      <iframe
        key={videoId}
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
```

Note: the `key={videoId}` forces React to remount the iframe when the video changes — that's how the "src updates on videoId change" test passes reliably across browsers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/__tests__/VideoPlayer.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/VideoPlayer.tsx src/components/home/__tests__/VideoPlayer.test.tsx
git commit -m "feat(home): add VideoPlayer component with YouTube embed"
```

---

### Task 8: `VideosSection` component (stateful composer)

**Files:**
- Create: `src/components/home/VideosSection.tsx`
- Create: `src/components/home/__tests__/VideosSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/home/__tests__/VideosSection.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideosSection } from "@/components/home/VideosSection";
import { MOCK_VIDEOS } from "@/lib/home/mockVideos";

describe("VideosSection", () => {
  it("renders the section title", () => {
    render(<VideosSection title="Latest Videos" locale="en" />);
    expect(screen.getByRole("heading", { name: "Latest Videos" })).toBeInTheDocument();
  });

  it("defaults to the first video and renders its iframe", () => {
    render(<VideosSection title="Latest Videos" locale="en" />);
    const first = MOCK_VIDEOS[0];
    const iframe = screen.getByTitle(first.title.en) as HTMLIFrameElement;
    expect(iframe.src).toContain(`youtube.com/embed/${first.id}`);
  });

  it("swaps the iframe when a list item is clicked", () => {
    render(<VideosSection title="Latest Videos" locale="en" />);
    const second = MOCK_VIDEOS[1];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(second.title.en) }));
    const iframe = screen.getByTitle(second.title.en) as HTMLIFrameElement;
    expect(iframe.src).toContain(`youtube.com/embed/${second.id}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/home/__tests__/VideosSection.test.tsx`
Expected: FAIL with "Cannot find module '@/components/home/VideosSection'".

- [ ] **Step 3: Write the component**

```tsx
// src/components/home/VideosSection.tsx
"use client";

import { useMemo, useState } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { VideoList } from "./VideoList";
import { MOCK_VIDEOS } from "@/lib/home/mockVideos";

type Props = {
  title: string;
  locale: string;
};

function pickTitle(
  title: { en: string; ar: string; fr: string },
  locale: string,
): string {
  if (locale === "ar") return title.ar;
  if (locale === "fr") return title.fr;
  return title.en;
}

export function VideosSection({ title, locale }: Props) {
  const [selectedId, setSelectedId] = useState<string>(MOCK_VIDEOS[0]?.id ?? "");

  const selected = useMemo(
    () => MOCK_VIDEOS.find((v) => v.id === selectedId) ?? MOCK_VIDEOS[0],
    [selectedId],
  );

  if (!selected) return null;

  return (
    <section className="mt-10">
      <h2 className="relative mb-4 text-xl font-bold">
        {title}
        <span className="absolute -bottom-1 start-0 h-0.5 w-12 bg-primary" />
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:h-[500px] lg:grid-cols-3">
        <div className="lg:col-span-2 lg:h-full">
          <VideoPlayer videoId={selected.id} title={pickTitle(selected.title, locale)} />
        </div>
        <div className="lg:h-full">
          <VideoList
            videos={MOCK_VIDEOS}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/home/__tests__/VideosSection.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/VideosSection.tsx src/components/home/__tests__/VideosSection.test.tsx
git commit -m "feat(home): add VideosSection composing player and list"
```

---

### Task 9: Add i18n keys for the new sections

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ar.json`
- Modify: `messages/fr.json`

- [ ] **Step 1: Update `messages/en.json` — replace the `home` block**

Replace the existing `"home"` object (currently containing `topNews`, `latestNews`, `matchStatus`) with:

```json
  "home": {
    "topNews": "Top News",
    "latestNews": "Latest News",
    "byLeague": "News by League",
    "latestVideos": "Latest Videos",
    "matchStatus": {
      "finished": "Ended",
      "live": "Live",
      "scheduled": "Upcoming"
    }
  },
```

- [ ] **Step 2: Update `messages/ar.json` — replace the `home` block**

```json
  "home": {
    "topNews": "أهم الأخبار",
    "latestNews": "آخر الأخبار",
    "byLeague": "الأخبار حسب البطولة",
    "latestVideos": "أحدث الفيديوهات",
    "matchStatus": {
      "finished": "منتهية",
      "live": "مباشر",
      "scheduled": "قادمة"
    }
  },
```

- [ ] **Step 3: Update `messages/fr.json` — replace the `home` block**

```json
  "home": {
    "topNews": "A la une",
    "latestNews": "Dernieres actualites",
    "byLeague": "Actualités par championnat",
    "latestVideos": "Dernières vidéos",
    "matchStatus": {
      "finished": "Terminés",
      "live": "En direct",
      "scheduled": "À venir"
    }
  },
```

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/ar.json messages/fr.json
git commit -m "feat(home): add i18n keys for league-news and videos sections"
```

---

### Task 10: Wire new sections into the homepage

**Files:**
- Modify: `src/app/(frontend)/[locale]/page.tsx`

- [ ] **Step 1: Replace the file contents**

Open `src/app/(frontend)/[locale]/page.tsx` and replace its full contents with:

```tsx
import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticles } from "@/lib/payload/queries";
import { getFixturesByDate } from "@/lib/api-football/fixtures";
import { HeroSection } from "@/components/home/HeroSection";
import { LeagueNewsSection } from "@/components/home/LeagueNewsSection";
import { VideosSection } from "@/components/home/VideosSection";
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:
      locale === "ar"
        ? "MFM Sport - أخبار الكرة المغربية"
        : locale === "fr"
          ? "MFM Sport - Actualites du football marocain"
          : "MFM Sport - Moroccan Football News",
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });
  const tArticle = await getTranslations({ locale, namespace: "article" });

  const today = new Date().toISOString().split("T")[0];
  const todayFixtures = await getFixturesByDate(today);

  const latest = await getArticles({ locale: locale as Config["locale"], page: 1, limit: 1 });
  const featured = latest.docs[0];

  const statusLabels = {
    finished: t("matchStatus.finished"),
    live: t("matchStatus.live"),
    scheduled: t("matchStatus.scheduled"),
  };

  if (!featured) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-primary mb-4">MFM Sport</h1>
        <p className="text-muted-foreground">{tArticle("noArticles")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="sr-only">MFM Sport</h1>

      <HeroSection
        featured={featured}
        fixtures={todayFixtures}
        locale={locale}
        statusLabels={statusLabels}
      />

      <LeagueNewsSection title={t("byLeague")} locale={locale} />

      <VideosSection title={t("latestVideos")} locale={locale} />

      <div className="mt-10">
        <NewsletterStrip locale={locale} />
      </div>
    </div>
  );
}
```

Key changes vs. the old file:
- `NewsSection` import → removed; `LeagueNewsSection` + `VideosSection` imports added.
- `getArticles` `limit` dropped from 16 → 1 (only the hero featured article is still needed from Payload).
- `topNews` / `moreNews` / `articles` slicing → removed.
- Two `<NewsSection>` JSX blocks → replaced with `<LeagueNewsSection>` + `<VideosSection>`.
- `tCommon` translator dropped (no `readMore` needed; sections own their headers).

- [ ] **Step 2: Build to confirm types are clean**

Run: `npm run build`
Expected: PASS (build completes without TypeScript or runtime errors).

If the build prints "remoteImages" or "next/image" host warnings for `picsum.photos`, `i.ytimg.com`, or `media.api-sports.io`, add the missing host to `next.config.ts` under `images.remotePatterns`. (Inspect the build log carefully — if the URLs render fine in dev, you can defer this; if `next/image` throws at runtime, add the patterns then.)

- [ ] **Step 3: Run dev server and smoke-test all three locales**

Run: `npm run dev`
Then in a browser:
1. Visit `http://localhost:3000/en` — confirm: HeroSection unchanged on top, then a "News by League" heading with a 2×2 grid (right/main) and a vertical list of league buttons (left/aside). Click "Premier League" → grid swaps to PL articles. Below that, "Latest Videos" with a YouTube iframe on the right/main and a scrollable list on the left/aside. Click a different video → iframe swaps.
2. Visit `http://localhost:3000/fr` — same behavior, French copy.
3. Visit `http://localhost:3000/ar` — same behavior, Arabic copy, RTL flips the big/small split (big half visually on the right, panel on the left), matching the existing HeroSection.

Stop the dev server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/app/(frontend)/[locale]/page.tsx
git commit -m "feat(home): replace stacked news grids with league-news and videos sections"
```

---

### Task 11: Full test suite + lint pass

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: PASS — all suites green, including the 6 new test files added in this plan (LeaguesPanel, NewsGrid2x2, LeagueNewsSection, VideoList, VideoPlayer, VideosSection).

If any pre-existing test fails because it depended on the old `NewsSection` / `topNews` / `latestNews` homepage shape, update that test to match the new layout. There are no test files currently under `src/components/home/__tests__/` referencing those names, so this should be a no-op — but verify.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit (only if lint produced fixes)**

```bash
git add -A
git commit -m "chore(home): lint pass on league-news and videos sections"
```

If lint produced no changes, skip the commit.

---

## Verification checklist

After Task 11 passes:

- [ ] Homepage in `en`, `fr`, `ar` shows: Hero → LeagueNewsSection → VideosSection → Newsletter (in that order).
- [ ] "Top News" and "Latest News" stacked grids are gone.
- [ ] Clicking a league in `LeaguesPanel` swaps the 2×2 grid contents without a page reload.
- [ ] Clicking a video in `VideoList` swaps the embedded YouTube iframe without a page reload.
- [ ] In Arabic (`/ar`), the big half is visually on the right and the panel on the left — matching `HeroSection` + `MatchesPanel`.
- [ ] All three new section headings (Hero is unchanged; the two new ones share `mt-10` spacing and the underline-accent heading style).
- [ ] `npm run test:run` and `npm run lint` both pass.
- [ ] No console errors in any locale.
