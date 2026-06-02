# Homepage Sections Overlap Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the visual collision where the homepage's "News by League" section (2×2 grid) overflows into the "Latest Videos" section below, and eliminate a separate hydration mismatch caused by non-deterministic timestamps in mock data.

**Architecture:** Three root causes are addressed: (1) `lg:h-[500px]` on both new sections is shorter than the natural content height of the 2×2 article grid → bottom-row cards extrude into the next section; (2) the `VideoPlayer` iframe wrapper uses `h-full` which depended on that fixed parent height; (3) `mockLeagueNews.ts` and `mockVideos.ts` compute `publishedAt` at module load via `new Date()`, producing different timestamps in the Node server render vs. the client hydration. Fix is to drop the fixed section heights, make `VideoPlayer` self-size via `aspect-video`, drop the now-orphaned `h-full` props on internal grid items, drop `sm:grid-rows-2` on the 2×2 grid, and replace runtime dates with hardcoded ISO strings.

**Tech Stack:** Tailwind utility classes only — no new dependencies. The fix is purely CSS / static data.

---

## Root cause walkthrough (reference)

At lg breakpoint with a ~1376px container and `lg:grid-cols-3 gap-4`:
- `col-span-2` ≈ 912px wide
- 2×2 grid inside (sm:grid-cols-2 gap-3) → cards ≈ 450px wide each
- Each card: aspect-video image (~253px) + content padding+title+date (~80px) = ~333px per card
- 2 rows + 12px gap = **~678px** of natural content height

The grid was constrained to `lg:h-[500px]` (~245px per row). The cards' actual rendered heights exceed this, overflowing the section. The next section (`VideosSection`) starts at `top: 540px` (header + 500px grid), so the bottom row's title/date visually appears inside the videos section.

Fix: drop the fixed height, let each section size by its content. The `LeaguesPanel` and `VideoList` keep their own `flex h-full overflow-y-auto` and naturally inherit the stretched cell height from the now-content-driven row.

For `VideoPlayer`: its inner iframe is `absolute inset-0 h-full w-full`. Without parent height, the absolute child has nothing to fill. Change the wrapper to `aspect-video w-full` so it self-sizes proportionally.

For the hydration error: `new Date().toISOString()` in `mockLeagueNews.ts` and `mockVideos.ts` runs once when the module is imported. In Next.js, the module is imported separately on the server (during SSR) and the client (during hydration) — the timestamps differ by hundreds of ms, causing React's hydration check to fail on `<time dateTime={...}>`. Fix: replace `new Date()` with hardcoded ISO date strings.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/home/mockLeagueNews.ts` | Replace runtime `new Date()` with fixed ISO date strings (hydration fix) |
| Modify | `src/lib/home/mockVideos.ts` | Same fix for video `publishedAt` |
| Modify | `src/components/home/NewsGrid2x2.tsx` | Drop `h-full`, drop `sm:grid-rows-2`, drop `h-full` from `<article>` |
| Modify | `src/components/home/LeagueNewsSection.tsx` | Drop `lg:h-[500px]` and inner `lg:h-full` wrappers |
| Modify | `src/components/home/VideosSection.tsx` | Drop `lg:h-[500px]` and inner `lg:h-full` wrappers |
| Modify | `src/components/home/VideoPlayer.tsx` | Wrapper from `h-full w-full` to `aspect-video w-full` |

No new files. No test changes (existing behavioral tests still pass — they don't assert on layout heights).

---

### Task 1: Replace runtime `new Date()` in mock-league-news data

**Files:**
- Modify: `src/lib/home/mockLeagueNews.ts`

- [ ] **Step 1: Replace the date arithmetic**

Open `src/lib/home/mockLeagueNews.ts`. Find the `makeArticle` helper (around lines 54–67) and replace its body so it accepts a precomputed ISO date string instead of computing one at runtime.

Before:
```ts
function makeArticle(
  leagueId: string,
  index: number,
  base: MockLocaleString,
  category: MockLocaleString,
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
```

After:
```ts
function makeArticle(
  leagueId: string,
  index: number,
  base: MockLocaleString,
  category: MockLocaleString,
  publishedAt: string,
): MockLeagueArticle {
  return {
    id: `${leagueId}-${index}`,
    leagueId,
    title: base,
    slug: `${leagueId}-article-${index}`,
    imageUrl: `https://picsum.photos/seed/${leagueId}-${index}/640/360`,
    category,
    publishedAt,
  };
}
```

- [ ] **Step 2: Replace every call site with a fixed ISO date**

Anchored on a deterministic reference date (today, the day this fix lands: 2026-05-13). Replace the entire `MOCK_LEAGUE_ARTICLES` array initializer so each `makeArticle` call's last argument is a fixed ISO string. The pattern: index 1 → 2026-05-13, index 2 → 2026-05-12, index 3 → 2026-05-11, index 4 → 2026-05-10. Use `T12:00:00.000Z` for all so they sort cleanly.

Replace the entire `MOCK_LEAGUE_ARTICLES` constant with:

```ts
export const MOCK_LEAGUE_ARTICLES: MockLeagueArticle[] = [
  // Botola Pro
  makeArticle("botola-pro", 1, { en: "Raja secure derby victory over Wydad", ar: "الرجاء يحقق فوزا في الديربي على الوداد", fr: "Le Raja remporte le derby face au Wydad" }, { en: "Botola", ar: "البطولة", fr: "Botola" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("botola-pro", 2, { en: "AS FAR climb to top of Botola standings", ar: "الجيش الملكي يتصدر ترتيب البطولة", fr: "L'AS FAR prend la tête du classement" }, { en: "Botola", ar: "البطولة", fr: "Botola" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("botola-pro", 3, { en: "RS Berkane lift Confederation Cup again", ar: "نهضة بركان تتوج بكأس الكاف من جديد", fr: "La RS Berkane remporte à nouveau la Coupe de la CAF" }, { en: "Continental", ar: "قاري", fr: "Continental" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("botola-pro", 4, { en: "Moroccan U23 squad announced for friendlies", ar: "الإعلان عن لائحة المنتخب الأولمبي للمباريات الودية", fr: "Liste des U23 marocains pour les amicaux dévoilée" }, { en: "National Team", ar: "المنتخب", fr: "Sélection" }, "2026-05-10T12:00:00.000Z"),

  // Champions League
  makeArticle("champions-league", 1, { en: "Real Madrid edge Bayern in semi-final thriller", ar: "ريال مدريد يتجاوز بايرن في إثارة نصف النهائي", fr: "Real Madrid bat le Bayern dans un demi-finale haletante" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("champions-league", 2, { en: "Man City through after dramatic comeback", ar: "مانشستر سيتي يتأهل بعد عودة درامية", fr: "Manchester City se qualifie après une remontée dramatique" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("champions-league", 3, { en: "Champions League final venue confirmed", ar: "تأكيد ملعب نهائي دوري الأبطال", fr: "Le stade de la finale de la LDC confirmé" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("champions-league", 4, { en: "Hakimi's PSG eliminated in quarters", ar: "إقصاء حكيمي وباريس في ربع النهائي", fr: "Hakimi et le PSG éliminés en quarts" }, { en: "UCL", ar: "أبطال أوروبا", fr: "LDC" }, "2026-05-10T12:00:00.000Z"),

  // Premier League
  makeArticle("premier-league", 1, { en: "Arsenal close gap at the top of the table", ar: "أرسنال يقلص الفارق في الصدارة", fr: "Arsenal réduit l'écart en tête du classement" }, { en: "PL", ar: "البريميرليغ", fr: "PL" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("premier-league", 2, { en: "Liverpool clinch derby win at Anfield", ar: "ليفربول يحقق فوز الديربي في أنفيلد", fr: "Liverpool remporte le derby à Anfield" }, { en: "PL", ar: "البريميرليغ", fr: "PL" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("premier-league", 3, { en: "Ziyech rumoured to make Premier League return", ar: "أنباء عن عودة زياش إلى البريميرليغ", fr: "Ziyech vers un retour en Premier League" }, { en: "Transfers", ar: "انتقالات", fr: "Transferts" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("premier-league", 4, { en: "Title race goes to the final matchday", ar: "صراع اللقب يحسم في الجولة الأخيرة", fr: "La course au titre se jouera lors de la dernière journée" }, { en: "PL", ar: "البريميرليغ", fr: "PL" }, "2026-05-10T12:00:00.000Z"),

  // La Liga
  makeArticle("la-liga", 1, { en: "Real Madrid crowned La Liga champions", ar: "ريال مدريد بطلا للدوري الإسباني", fr: "Le Real Madrid sacré champion de La Liga" }, { en: "La Liga", ar: "الليغا", fr: "Liga" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("la-liga", 2, { en: "Barcelona youngster signs new long-term deal", ar: "موهبة برشلونة توقع عقدا طويل الأمد", fr: "Le jeune barcelonais prolonge son contrat" }, { en: "Transfers", ar: "انتقالات", fr: "Transferts" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("la-liga", 3, { en: "Atletico clinch Champions League spot", ar: "أتلتيكو يضمن مقعدا في دوري الأبطال", fr: "L'Atlético décroche son ticket pour la LDC" }, { en: "La Liga", ar: "الليغا", fr: "Liga" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("la-liga", 4, { en: "Sevilla appoint new head coach", ar: "إشبيلية يعين مدربا جديدا", fr: "Séville nomme un nouvel entraîneur" }, { en: "La Liga", ar: "الليغا", fr: "Liga" }, "2026-05-10T12:00:00.000Z"),

  // Serie A
  makeArticle("serie-a", 1, { en: "Inter retain Scudetto with games to spare", ar: "إنتر يحتفظ بالسكوديتو قبل نهاية الموسم", fr: "L'Inter conserve le Scudetto avant la fin de saison" }, { en: "Serie A", ar: "السيري آ", fr: "Serie A" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("serie-a", 2, { en: "Juventus rebuild continues with new signings", ar: "يوفنتوس يواصل إعادة البناء بصفقات جديدة", fr: "La Juventus poursuit sa reconstruction avec de nouvelles recrues" }, { en: "Transfers", ar: "انتقالات", fr: "Transferts" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("serie-a", 3, { en: "Napoli search for next coach", ar: "نابولي يبحث عن مدرب جديد", fr: "Naples cherche son prochain entraîneur" }, { en: "Serie A", ar: "السيري آ", fr: "Serie A" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("serie-a", 4, { en: "Milan derby ends in dramatic draw", ar: "ديربي ميلانو ينتهي بتعادل مثير", fr: "Le derby de Milan se termine sur un nul dramatique" }, { en: "Serie A", ar: "السيري آ", fr: "Serie A" }, "2026-05-10T12:00:00.000Z"),

  // Ligue 1
  makeArticle("ligue-1", 1, { en: "PSG seal another Ligue 1 title", ar: "باريس يحسم لقب الليغ آن مجددا", fr: "Le PSG décroche un nouveau titre de Ligue 1" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, "2026-05-13T12:00:00.000Z"),
  makeArticle("ligue-1", 2, { en: "Monaco confirm European football return", ar: "موناكو يؤكد العودة إلى المسابقات الأوروبية", fr: "Monaco confirme son retour en coupe d'Europe" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, "2026-05-12T12:00:00.000Z"),
  makeArticle("ligue-1", 3, { en: "Marseille hire new sporting director", ar: "مارسيليا يعين مديرا رياضيا جديدا", fr: "Marseille recrute un nouveau directeur sportif" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, "2026-05-11T12:00:00.000Z"),
  makeArticle("ligue-1", 4, { en: "Lyon clinch final European spot", ar: "ليون يخطف آخر مقعد أوروبي", fr: "Lyon arrache la dernière place européenne" }, { en: "Ligue 1", ar: "الليغ آن", fr: "Ligue 1" }, "2026-05-10T12:00:00.000Z"),
];
```

- [ ] **Step 3: Run the existing tests to confirm nothing broke**

Run: `npx vitest run src/components/home/__tests__/LeagueNewsSection.test.tsx src/components/home/__tests__/NewsGrid2x2.test.tsx`
Expected: All passing (no test asserts on the specific date values — only on titles and counts).

- [ ] **Step 4: Commit**

```bash
git add src/lib/home/mockLeagueNews.ts
git commit -m "fix(home): use deterministic publishedAt in mockLeagueNews to fix SSR hydration"
```

---

### Task 2: Replace runtime `new Date()` in mock-videos data

**Files:**
- Modify: `src/lib/home/mockVideos.ts`

- [ ] **Step 1: Replace the `daysAgo` helper and inline its values**

The current `daysAgo(n)` helper calls `new Date()` at module load, producing non-deterministic ISO strings. Replace each `publishedAt: daysAgo(N)` with a fixed ISO string for the same reference date (2026-05-13 minus N days). Drop the `daysAgo` helper entirely.

Open `src/lib/home/mockVideos.ts` and replace the file contents with:

```ts
import type { MockLocaleString } from "./mockLeagueNews";

export type MockVideo = {
  id: string;
  title: MockLocaleString;
  thumbnailUrl: string;
  duration: string;
  publishedAt: string;
};

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
    publishedAt: "2026-05-13T12:00:00.000Z",
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
    publishedAt: "2026-05-12T12:00:00.000Z",
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
    publishedAt: "2026-05-11T12:00:00.000Z",
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
    publishedAt: "2026-05-11T12:00:00.000Z",
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
    publishedAt: "2026-05-10T12:00:00.000Z",
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
    publishedAt: "2026-05-09T12:00:00.000Z",
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
    publishedAt: "2026-05-08T12:00:00.000Z",
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
    publishedAt: "2026-05-07T12:00:00.000Z",
  },
];
```

- [ ] **Step 2: Run the existing video tests**

Run: `npx vitest run src/components/home/__tests__/VideoList.test.tsx src/components/home/__tests__/VideosSection.test.tsx src/components/home/__tests__/VideoPlayer.test.tsx`
Expected: all passing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/home/mockVideos.ts
git commit -m "fix(home): use deterministic publishedAt in mockVideos to fix SSR hydration"
```

---

### Task 3: Drop fixed height in `NewsGrid2x2`

**Files:**
- Modify: `src/components/home/NewsGrid2x2.tsx`

The outer grid has `h-full grid-cols-1 ... sm:grid-cols-2 sm:grid-rows-2`. With the parent's fixed height being dropped (Task 4), `h-full` resolves to 0 and `sm:grid-rows-2` is no longer meaningful (4 items in 2 cols flow into 2 rows automatically). Each `<article>` also has `h-full` which depended on the row constraint.

- [ ] **Step 1: Edit the file**

Open `src/components/home/NewsGrid2x2.tsx`. Apply two edits:

Edit 1 — outer grid div. Before:
```tsx
    <div className="grid h-full grid-cols-1 gap-3 sm:grid-cols-2 sm:grid-rows-2">
```
After:
```tsx
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
```

Edit 2 — the `<article>`. Before:
```tsx
        <article
          key={article.id}
          className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30"
        >
```
After:
```tsx
        <article
          key={article.id}
          className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30"
        >
```

- [ ] **Step 2: Run the NewsGrid2x2 test**

Run: `npx vitest run src/components/home/__tests__/NewsGrid2x2.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
git add src/components/home/NewsGrid2x2.tsx
git commit -m "fix(home): drop fixed grid height and row constraint in NewsGrid2x2"
```

---

### Task 4: Drop fixed height in `LeagueNewsSection`

**Files:**
- Modify: `src/components/home/LeagueNewsSection.tsx`

The section grid has `lg:h-[500px]` and both inner column wrappers carry `lg:h-full`. Drop all three.

- [ ] **Step 1: Edit the file**

Open `src/components/home/LeagueNewsSection.tsx`. Find the section content block and apply three edits:

Edit 1 — outer grid. Before:
```tsx
      <div className="grid grid-cols-1 gap-4 lg:h-[500px] lg:grid-cols-3">
```
After:
```tsx
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
```

Edit 2 — first inner wrapper (NewsGrid2x2). Before:
```tsx
        <div className="lg:col-span-2 lg:h-full">
          <NewsGrid2x2 articles={articles} locale={locale} />
        </div>
```
After:
```tsx
        <div className="lg:col-span-2">
          <NewsGrid2x2 articles={articles} locale={locale} />
        </div>
```

Edit 3 — second inner wrapper (LeaguesPanel). Before:
```tsx
        <div className="lg:h-full overflow-y-auto">
          <LeaguesPanel
            leagues={MOCK_LEAGUES}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
```
After (drop the wrapper `overflow-y-auto` because the panel's own root already has it, and drop the now-broken `lg:h-full`):
```tsx
        <div>
          <LeaguesPanel
            leagues={MOCK_LEAGUES}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
```

The `LeaguesPanel`'s internal `h-full` will now resolve against the grid cell which (by default `align-items: stretch` on CSS grid) stretches to match the sibling's content height. So the panel will visually grow to match the 2×2 news grid's natural height without any explicit pixel constraint.

- [ ] **Step 2: Run the LeagueNewsSection test**

Run: `npx vitest run src/components/home/__tests__/LeagueNewsSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add src/components/home/LeagueNewsSection.tsx
git commit -m "fix(home): drop fixed 500px height on LeagueNewsSection so 2x2 grid fits"
```

---

### Task 5: Fix `VideoPlayer` to self-size via `aspect-video`

**Files:**
- Modify: `src/components/home/VideoPlayer.tsx`

The wrapper currently uses `h-full w-full`. Without a parent height (post-fix), the iframe inside has nothing to fill. Change wrapper to `aspect-video w-full` so it sizes proportionally to its column width.

- [ ] **Step 1: Edit the file**

Open `src/components/home/VideoPlayer.tsx`. Apply this single edit:

Before:
```tsx
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black">
```
After:
```tsx
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
```

- [ ] **Step 2: Run the VideoPlayer test**

Run: `npx vitest run src/components/home/__tests__/VideoPlayer.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add src/components/home/VideoPlayer.tsx
git commit -m "fix(home): use aspect-video on VideoPlayer wrapper for content-driven sizing"
```

---

### Task 6: Drop fixed height in `VideosSection`

**Files:**
- Modify: `src/components/home/VideosSection.tsx`

Same shape of fix as Task 4. The grid loses its 500px constraint; both inner wrappers lose `lg:h-full`; the panel's wrapper also loses redundant `overflow-y-auto`.

- [ ] **Step 1: Edit the file**

Open `src/components/home/VideosSection.tsx`. Apply three edits:

Edit 1 — outer grid. Before:
```tsx
      <div className="grid grid-cols-1 gap-4 lg:h-[500px] lg:grid-cols-3">
```
After:
```tsx
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
```

Edit 2 — first inner wrapper (VideoPlayer). Before:
```tsx
        <div className="lg:col-span-2 lg:h-full">
          <VideoPlayer videoId={selected.id} title={pickTitle(selected.title, locale)} />
        </div>
```
After:
```tsx
        <div className="lg:col-span-2">
          <VideoPlayer videoId={selected.id} title={pickTitle(selected.title, locale)} />
        </div>
```

Edit 3 — second inner wrapper (VideoList). Before:
```tsx
        <div className="lg:h-full overflow-y-auto">
          <VideoList
            videos={MOCK_VIDEOS}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
```
After:
```tsx
        <div>
          <VideoList
            videos={MOCK_VIDEOS}
            selectedId={selectedId}
            locale={locale}
            onSelect={setSelectedId}
          />
        </div>
```

- [ ] **Step 2: Run the VideosSection test**

Run: `npx vitest run src/components/home/__tests__/VideosSection.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add src/components/home/VideosSection.tsx
git commit -m "fix(home): drop fixed 500px height on VideosSection to match content"
```

---

### Task 7: Full test suite + visual verification

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: PASS — all suites green.

- [ ] **Step 2: Confirm dev server is running on port 3002 or 3003**

If not already running, start it: `npm run dev`. Wait for "Ready in" line. Note which port it bound to.

- [ ] **Step 3: Screenshot in three locales**

Using the Playwright MCP tools (already available in this environment), at viewport 1440×900:
1. Navigate to `http://localhost:<port>/en`, screenshot full page as `qa-fix-en.jpeg`.
2. Navigate to `http://localhost:<port>/fr`, screenshot as `qa-fix-fr.jpeg`.
3. Navigate to `http://localhost:<port>/ar`, screenshot as `qa-fix-ar.jpeg`.

- [ ] **Step 4: Inspect each screenshot**

Open each JPEG with the Read tool. Check:
- **"News by League" section**: the 2×2 grid renders all 4 cards completely (title and date visible for every card). No text bleeds into the next section.
- **Clear visual gap** between "News by League" and "Latest Videos" sections (the `mt-10` margin is fully respected).
- **"Latest Videos" section**: the video player has reasonable size (16:9 aspect, not a 500px-tall slab). The video list to the side stacks naturally.
- **Arabic locale**: the panel still appears on the left side of the section (RTL flip is intact), text reads right-to-left, and same vertical layout integrity holds.

If any of the above fails, stop and report. Otherwise:

- [ ] **Step 5: Commit visual verification artifacts (optional)**

If the user wants the QA screenshots tracked, commit them. Otherwise leave them untracked. The dev server doesn't need to be stopped.

---

## Verification checklist

After Task 7:

- [ ] No 2×2 card text overlaps the "Latest Videos" heading
- [ ] No hydration warning about `dateTime` mismatch in browser console
- [ ] All 81+ tests still pass
- [ ] Both new sections size by their content; no fixed pixel heights
- [ ] `VideoPlayer` renders at 16:9 aspect ratio, scales with its column width
- [ ] `LeaguesPanel` stretches to match the 2×2 grid's natural height (CSS grid default `align-items: stretch`)
- [ ] `VideoList` does the same against the video player's height
- [ ] RTL (Arabic) layout still flips the big/small columns correctly
