# Preview Content Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the database with realistic demo articles so the homepage, articles list, article detail, category, and search pages render with content — letting the editorial team preview the full layout before the WordPress migration runs.

**Architecture:** A disposable `seed:preview` tsx script uses the Payload Local API to insert 1 demo author + 18 published demo articles across the 9 existing categories in all 3 locales (ar/fr/en). Articles include Lexical rich-text bodies, excerpts, category links, and `publishedAt` timestamps staggered over the past 14 days. No featured images — components already render a "MFM Sport" placeholder div when `featuredImage` is null. A companion `seed:preview:reset` script deletes only docs with the `demo-` slug prefix so real migrated content is untouched.

**Tech Stack:** tsx, Payload 3 Local API (`getPayload`), Lexical JSON (Payload's rich-text format), TypeScript strict mode.

**Discovered state (from investigation):**
- `src/app/(frontend)/[locale]/page.tsx:49-56` renders the empty state when no `featured` article exists
- `src/components/home/HeroSection.tsx` and `src/components/articles/ArticleCard.tsx` handle `featuredImage === null` via a bg-secondary div with text "MFM Sport"
- `src/lib/payload/queries.ts:11-29` filters by `status: { equals: 'published' }` and sorts by `-publishedAt` — seed must set both
- `src/collections/Articles.ts` requires: `title`, `slug`, `body`, `author`, `status`. All localized fields: `title`, `excerpt`, `body`
- 9 categories already seeded (see [scripts/seed.ts](../../../scripts/seed.ts))
- Slug uniqueness is required — preview slugs use `demo-` prefix to avoid collision

---

## File Structure

- **Create:** `scripts/seed-preview.ts` — generates 1 author + 18 articles + optional reset flag
- **Modify:** `package.json` — add `seed:preview` and `seed:preview:reset` npm scripts
- **No UI/component changes** — layout already handles the data correctly

---

### Task 1: Create the preview seed script skeleton

**Files:**
- Create: `scripts/seed-preview.ts`

- [ ] **Step 1: Write the script with author + empty articles loop**

Content:

```ts
/**
 * MFM Sport — Disposable Preview Content Seed
 *
 * Usage:
 *   pnpm seed:preview          # creates 1 demo author + 18 demo articles
 *   pnpm seed:preview:reset    # deletes ONLY docs with demo- slug prefix
 *
 * Safe to run before WordPress migration:
 * - All docs have slugs prefixed with "demo-" so real articles are never touched
 * - Reset removes only those demo- docs
 */

import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";

type Payload = Awaited<ReturnType<typeof getPayload>>;

const DEMO_PREFIX = "demo-";

function lexicalParagraph(text: string, direction: "ltr" | "rtl" = "ltr") {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction,
      children: [
        {
          type: "paragraph",
          format: "",
          indent: 0,
          version: 1,
          direction,
          children: [
            {
              type: "text",
              text,
              format: 0,
              style: "",
              mode: "normal",
              detail: 0,
              version: 1,
            },
          ],
        },
      ],
    },
  };
}

async function resetDemo(payload: Payload) {
  console.log("\n--- Resetting demo content ---");
  for (const collection of ["articles", "authors"] as const) {
    const res = await payload.find({
      collection,
      where: { slug: { like: DEMO_PREFIX } },
      limit: 1000,
      overrideAccess: true,
    });
    for (const doc of res.docs) {
      if ((doc as any).slug?.startsWith(DEMO_PREFIX)) {
        await payload.delete({ collection, id: doc.id, overrideAccess: true });
        console.log(`  [deleted] ${collection}/${(doc as any).slug}`);
      }
    }
  }
}

async function main() {
  console.log("=== MFM Sport Preview Seed ===");
  const payload = await getPayload({ config });

  if (process.argv.includes("--reset")) {
    await resetDemo(payload);
    console.log("\n=== Reset Complete ===");
    process.exit(0);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Preview seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm scripts**

Modify `package.json` scripts block:

```json
"seed": "tsx scripts/seed.ts",
"seed:preview": "tsx scripts/seed-preview.ts",
"seed:preview:reset": "tsx scripts/seed-preview.ts --reset"
```

- [ ] **Step 3: Verify reset path runs (no-op with empty DB)**

Run: `pnpm seed:preview:reset`
Expected: prints `--- Resetting demo content ---` and `=== Reset Complete ===` with no errors, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-preview.ts package.json
git commit -m "feat: add preview seed skeleton with reset flag"
```

---

### Task 2: Seed the demo author

**Files:**
- Modify: `scripts/seed-preview.ts`

- [ ] **Step 1: Add `seedAuthor` function and call it from `main`**

Add above `async function resetDemo`:

```ts
async function seedAuthor(payload: Payload): Promise<string | number> {
  const slug = `${DEMO_PREFIX}editorial-team`;
  const existing = await payload.find({
    collection: "authors",
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  });
  if (existing.docs[0]) {
    console.log(`  [skip] author ${slug}`);
    return existing.docs[0].id;
  }
  const created = await payload.create({
    collection: "authors",
    data: {
      name: "فريق التحرير",
      slug,
      bio: "محتوى تجريبي — سيُستبدل بعد استيراد المقالات الأصلية.",
    },
    locale: "ar",
    overrideAccess: true,
  });
  await payload.update({
    collection: "authors",
    id: created.id,
    data: {
      name: "Équipe éditoriale",
      bio: "Contenu de démo — sera remplacé après l'import des articles.",
    },
    locale: "fr",
    overrideAccess: true,
  });
  await payload.update({
    collection: "authors",
    id: created.id,
    data: {
      name: "Editorial Team",
      bio: "Demo content — will be replaced after WordPress migration.",
    },
    locale: "en",
    overrideAccess: true,
  });
  console.log(`  [created] author ${slug}`);
  return created.id;
}
```

Modify `main` to insert this before the `--reset` check is false:

```ts
async function main() {
  console.log("=== MFM Sport Preview Seed ===");
  const payload = await getPayload({ config });

  if (process.argv.includes("--reset")) {
    await resetDemo(payload);
    console.log("\n=== Reset Complete ===");
    process.exit(0);
  }

  console.log("\n--- Seeding demo author ---");
  const authorId = await seedAuthor(payload);

  process.exit(0);
}
```

- [ ] **Step 2: Run and verify the author exists**

Run: `pnpm seed:preview`
Expected output contains `[created] author demo-editorial-team`.

Verify via: `NODE_PATH="$(pwd)/node_modules/.pnpm/pg@8.20.0/node_modules" node --env-file=.env -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query(\"SELECT slug,name FROM authors WHERE slug LIKE 'demo-%'\")).then(r=>{console.log(r.rows);return c.end();})"`
Expected: 1 row with `slug: demo-editorial-team`.

- [ ] **Step 3: Verify idempotency**

Run `pnpm seed:preview` again.
Expected: output contains `[skip] author demo-editorial-team` (not `[created]`).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-preview.ts
git commit -m "feat: seed demo author for preview content"
```

---

### Task 3: Seed 18 demo articles across categories and locales

**Files:**
- Modify: `scripts/seed-preview.ts`

- [ ] **Step 1: Add article dataset + seeder function**

Add after `seedAuthor` function:

```ts
type DemoArticle = {
  slugSuffix: string;
  categorySlug: string;
  daysAgo: number;
  ar: { title: string; excerpt: string; body: string };
  fr: { title: string; excerpt: string; body: string };
  en: { title: string; excerpt: string; body: string };
};

const DEMO_ARTICLES: DemoArticle[] = [
  {
    slugSuffix: "botola-matchday-review",
    categorySlug: "botola-pro-1-cat",
    daysAgo: 0,
    ar: { title: "مراجعة الجولة: الوداد يعود إلى الصدارة", excerpt: "ملخص مباريات اليوم في البطولة الاحترافية 1.", body: "فاز الوداد الرياضي في مباراة مثيرة، وعاد إلى صدارة الترتيب العام." },
    fr: { title: "Retour sur la journée : le Wydad reprend la tête", excerpt: "Résumé des matchs du jour en Botola Pro 1.", body: "Le Wydad s'est imposé dans une rencontre animée et reprend la première place." },
    en: { title: "Matchday Review: Wydad Reclaim the Top Spot", excerpt: "Today's Botola Pro 1 fixtures summary.", body: "Wydad AC won a thrilling match and climbed back to the top of the table." },
  },
  {
    slugSuffix: "raja-coach-interview",
    categorySlug: "botola-pro-1-cat",
    daysAgo: 1,
    ar: { title: "مدرب الرجاء يتحدث عن طموحات الموسم", excerpt: "حوار حصري مع المدير الفني.", body: "أكد المدرب في تصريحات خاصة أن الفريق يستهدف اللقب القاري." },
    fr: { title: "L'entraîneur du Raja parle des ambitions de la saison", excerpt: "Entretien exclusif avec le technicien.", body: "Le coach affirme viser un titre continental cette saison." },
    en: { title: "Raja Coach on Season Ambitions", excerpt: "Exclusive interview with the head coach.", body: "The coach confirmed continental silverware is the top target." },
  },
  {
    slugSuffix: "caf-champions-league-draw",
    categorySlug: "caf-champions-league-cat",
    daysAgo: 2,
    ar: { title: "قرعة دوري أبطال أفريقيا: مواجهات نارية", excerpt: "الأندية المغربية تعرف منافسيها.", body: "أسفرت القرعة عن مواجهات قوية في مرحلة المجموعات." },
    fr: { title: "Tirage de la LDC africaine : des chocs en perspective", excerpt: "Les clubs marocains connaissent leurs adversaires.", body: "Le tirage a accouché d'affiches relevées en phase de groupes." },
    en: { title: "CAF Champions League Draw: Fireworks Ahead", excerpt: "Moroccan clubs learn their opponents.", body: "The draw produced high-profile group stage clashes." },
  },
  {
    slugSuffix: "afcon-morocco-squad",
    categorySlug: "africa-cup-of-nations-cat",
    daysAgo: 3,
    ar: { title: "قائمة المنتخب المغربي استعدادا لكأس أفريقيا", excerpt: "المدرب يختار 26 لاعبا.", body: "ضمت القائمة عناصر شابة ونجوما متمرسة." },
    fr: { title: "Liste des Lions de l'Atlas pour la CAN", excerpt: "26 joueurs retenus par le sélectionneur.", body: "La liste mélange jeunes talents et cadres expérimentés." },
    en: { title: "Morocco's AFCON Squad Unveiled", excerpt: "26-man roster selected by the head coach.", body: "The squad blends young talents with experienced leaders." },
  },
  {
    slugSuffix: "world-cup-2026-ticketing",
    categorySlug: "world-cup-2026",
    daysAgo: 4,
    ar: { title: "فتح باب حجز تذاكر كأس العالم 2026", excerpt: "تفاصيل المراحل والأسعار.", body: "أعلنت فيفا عن المرحلة الأولى من بيع التذاكر." },
    fr: { title: "Billetterie Coupe du Monde 2026 : ouverture des ventes", excerpt: "Phases et tarifs dévoilés.", body: "La FIFA annonce la première phase de vente des billets." },
    en: { title: "FIFA World Cup 2026 Ticketing Opens", excerpt: "Phases and pricing revealed.", body: "FIFA unveiled the first ticket sales phase." },
  },
  {
    slugSuffix: "premier-league-weekend",
    categorySlug: "premier-league-cat",
    daysAgo: 5,
    ar: { title: "نتائج جولة البريميرليغ", excerpt: "نقاط كاملة للمتصدر.", body: "واصل الفريق المتصدر سلسلة انتصاراته في البريميرليغ." },
    fr: { title: "Les résultats du week-end en Premier League", excerpt: "Le leader enchaîne.", body: "Le leader poursuit sa série de victoires." },
    en: { title: "Premier League Weekend Roundup", excerpt: "Leaders keep rolling.", body: "The league leaders extended their winning run." },
  },
  {
    slugSuffix: "laliga-el-clasico",
    categorySlug: "la-liga-cat",
    daysAgo: 6,
    ar: { title: "الكلاسيكو يقترب: أرقام وإحصائيات", excerpt: "كل ما تحتاج معرفته قبل المباراة.", body: "يستعد ريال مدريد وبرشلونة لمواجهة حاسمة." },
    fr: { title: "Le Clasico approche : chiffres et stats", excerpt: "Tout ce qu'il faut savoir avant le match.", body: "Real et Barça se préparent pour un choc décisif." },
    en: { title: "El Clasico Approaches: Numbers and Stats", excerpt: "Everything to know before kickoff.", body: "Real Madrid and Barcelona gear up for a decisive showdown." },
  },
  {
    slugSuffix: "continental-coach-appointment",
    categorySlug: "continental",
    daysAgo: 7,
    ar: { title: "تعيين مدرب جديد لمنتخب قاري", excerpt: "خطوة نحو بناء جيل جديد.", body: "أعلن الاتحاد عن تعاقده مع مدرب ذي خبرة قارية." },
    fr: { title: "Nomination d'un nouveau sélectionneur continental", excerpt: "Un pas vers une nouvelle génération.", body: "La fédération officialise l'arrivée d'un coach aguerri." },
    en: { title: "New Continental Team Coach Announced", excerpt: "A step toward rebuilding.", body: "The federation confirmed the appointment of an experienced coach." },
  },
  {
    slugSuffix: "european-transfer-rumors",
    categorySlug: "europe",
    daysAgo: 8,
    ar: { title: "شائعات الانتقالات الأوروبية: من إلى أين؟", excerpt: "أبرز الصفقات المتوقعة.", body: "الميركاتو الأوروبي يشهد حركة نشطة هذه الفترة." },
    fr: { title: "Rumeurs mercato en Europe : qui va où ?", excerpt: "Les transferts les plus probables.", body: "Le mercato européen s'active à l'approche de la fenêtre." },
    en: { title: "European Transfer Rumors: Who Goes Where?", excerpt: "The most likely deals.", body: "The European transfer market is heating up." },
  },
  {
    slugSuffix: "botola-relegation-battle",
    categorySlug: "el-botola",
    daysAgo: 9,
    ar: { title: "صراع الهروب من الهبوط يشتد", excerpt: "أربعة فرق في دائرة الخطر.", body: "المنافسة على البقاء في دوري الأضواء تزداد اشتعالا." },
    fr: { title: "La lutte pour le maintien s'intensifie", excerpt: "Quatre clubs en zone rouge.", body: "La bataille pour rester dans l'élite s'annonce serrée." },
    en: { title: "Botola Relegation Battle Heats Up", excerpt: "Four clubs in the danger zone.", body: "The fight to stay in the top flight grows fierce." },
  },
  {
    slugSuffix: "atlas-lions-friendly",
    categorySlug: "continental",
    daysAgo: 10,
    ar: { title: "مباراة ودية قوية للمنتخب الوطني", excerpt: "اختبار مهم قبل المسابقات الرسمية.", body: "يلتقي أسود الأطلس مع منتخب عالمي في اختبار قوي." },
    fr: { title: "Les Lions de l'Atlas en amical prestigieux", excerpt: "Un test sérieux avant les échéances.", body: "Le Maroc affronte une sélection majeure en amical." },
    en: { title: "Atlas Lions in Prestigious Friendly", excerpt: "A serious pre-competition test.", body: "Morocco face a major side in a high-profile friendly." },
  },
  {
    slugSuffix: "wydad-transfer-deal",
    categorySlug: "botola-pro-1-cat",
    daysAgo: 11,
    ar: { title: "الوداد يتعاقد مع نجم جديد", excerpt: "تدعيم الخط الأمامي.", body: "أعلن النادي الأحمر عن تعاقده مع مهاجم دولي." },
    fr: { title: "Le Wydad signe une nouvelle star", excerpt: "Renfort offensif de poids.", body: "Le club annonce l'arrivée d'un attaquant international." },
    en: { title: "Wydad Sign a New Star", excerpt: "Big attacking reinforcement.", body: "The club confirmed the arrival of an international striker." },
  },
  {
    slugSuffix: "laliga-top-scorers",
    categorySlug: "la-liga-cat",
    daysAgo: 12,
    ar: { title: "ترتيب هدافي الليغا", excerpt: "نجوم يتصدرون القائمة.", body: "يتواصل صراع الحذاء الذهبي بين مهاجمين بارزين." },
    fr: { title: "Classement des buteurs en Liga", excerpt: "Les stars en tête.", body: "La course au soulier d'or fait rage entre les attaquants." },
    en: { title: "La Liga Top Scorers Ranking", excerpt: "Stars lead the chart.", body: "The Golden Boot race intensifies among elite strikers." },
  },
  {
    slugSuffix: "premier-league-injury-news",
    categorySlug: "premier-league-cat",
    daysAgo: 13,
    ar: { title: "إصابات تهز البريميرليغ قبل الجولة المقبلة", excerpt: "غيابات مؤثرة.", body: "يعاني عدد من الأندية من موجة إصابات قبل الجولة القادمة." },
    fr: { title: "Vague de blessures en Premier League", excerpt: "Absences impactantes.", body: "Plusieurs clubs subissent des pépins physiques avant la journée." },
    en: { title: "Premier League Hit by Injury Wave", excerpt: "Impactful absences.", body: "Multiple clubs face injury concerns ahead of the next matchday." },
  },
  {
    slugSuffix: "confederation-cup-quarters",
    categorySlug: "continental",
    daysAgo: 14,
    ar: { title: "ربع نهائي كأس الكونفدرالية: مواجهات متكافئة", excerpt: "مواعيد ومحطات.", body: "سيشهد الدور ربع النهائي مواجهات مغربية عربية." },
    fr: { title: "Quarts de la Coupe de la Confédération : affiches équilibrées", excerpt: "Dates et lieux.", body: "Les quarts verront des duels maroco-arabes savoureux." },
    en: { title: "Confederation Cup Quarters: Even Match-ups", excerpt: "Dates and venues.", body: "The quarter-finals will feature enticing Moroccan-Arab duels." },
  },
  {
    slugSuffix: "afcon-opening-ceremony",
    categorySlug: "africa-cup-of-nations-cat",
    daysAgo: 1,
    ar: { title: "حفل افتتاح كأس أفريقيا: مزيج من الفن والرياضة", excerpt: "عرض مبهر بألوان القارة.", body: "نظمت لجنة التنظيم حفل افتتاح بحضور نجوم عالميين." },
    fr: { title: "Cérémonie d'ouverture de la CAN : art et sport réunis", excerpt: "Un spectacle aux couleurs du continent.", body: "Le comité d'organisation a mis les petits plats dans les grands." },
    en: { title: "AFCON Opening Ceremony: Art Meets Sport", excerpt: "A show in continental colors.", body: "The organizing committee delivered a spectacular opening." },
  },
  {
    slugSuffix: "uefa-cl-matchday",
    categorySlug: "europe",
    daysAgo: 2,
    ar: { title: "جولة نارية في دوري أبطال أوروبا", excerpt: "مواجهات تحدد مصير الفرق.", body: "تنتظر جماهير الأبطال جولة حاسمة بنتائج غير متوقعة." },
    fr: { title: "Journée brûlante en Ligue des Champions", excerpt: "Des matchs décisifs pour la qualification.", body: "Les supporters attendent une soirée couperet en C1." },
    en: { title: "Hot UEFA Champions League Matchday", excerpt: "Decisive fixtures for qualification.", body: "Fans brace for a decisive night in the Champions League." },
  },
  {
    slugSuffix: "raja-youth-academy",
    categorySlug: "el-botola",
    daysAgo: 3,
    ar: { title: "أكاديمية الشباب: موهبة جديدة تصعد للفريق الأول", excerpt: "ثمار العمل مع الناشئين.", body: "صعد لاعب شاب من الأكاديمية إلى قائمة الفريق الأول." },
    fr: { title: "Académie des jeunes : un talent rejoint l'équipe première", excerpt: "Le fruit du travail en formation.", body: "Un jeune joueur du centre intègre l'équipe première." },
    en: { title: "Youth Academy: New Talent Promoted to First Team", excerpt: "The fruit of youth development.", body: "A young academy player earned a first-team call-up." },
  },
];

async function seedArticles(payload: Payload, authorId: string | number) {
  console.log("\n--- Seeding demo articles ---");
  const categories = await payload.find({
    collection: "categories",
    limit: 100,
    overrideAccess: true,
  });
  const categoryIdBySlug = new Map<string, string | number>();
  for (const c of categories.docs) {
    categoryIdBySlug.set((c as any).slug, c.id);
  }

  const now = Date.now();

  for (const a of DEMO_ARTICLES) {
    const slug = `${DEMO_PREFIX}${a.slugSuffix}`;
    const existing = await payload.find({
      collection: "articles",
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    });
    if (existing.docs[0]) {
      console.log(`  [skip] ${slug}`);
      continue;
    }

    const categoryId = categoryIdBySlug.get(a.categorySlug);
    const publishedAt = new Date(now - a.daysAgo * 86400000).toISOString();

    const created = await payload.create({
      collection: "articles",
      data: {
        title: a.ar.title,
        slug,
        excerpt: a.ar.excerpt,
        body: lexicalParagraph(a.ar.body, "rtl") as any,
        author: authorId as any,
        categories: categoryId ? [categoryId as any] : [],
        status: "published",
        publishedAt,
      },
      locale: "ar",
      overrideAccess: true,
    });

    await payload.update({
      collection: "articles",
      id: created.id,
      data: {
        title: a.fr.title,
        excerpt: a.fr.excerpt,
        body: lexicalParagraph(a.fr.body, "ltr") as any,
      },
      locale: "fr",
      overrideAccess: true,
    });

    await payload.update({
      collection: "articles",
      id: created.id,
      data: {
        title: a.en.title,
        excerpt: a.en.excerpt,
        body: lexicalParagraph(a.en.body, "ltr") as any,
      },
      locale: "en",
      overrideAccess: true,
    });

    console.log(`  [created] ${slug}`);
  }
}
```

Modify `main` to call `seedArticles` after `seedAuthor`:

```ts
async function main() {
  console.log("=== MFM Sport Preview Seed ===");
  const payload = await getPayload({ config });

  if (process.argv.includes("--reset")) {
    await resetDemo(payload);
    console.log("\n=== Reset Complete ===");
    process.exit(0);
  }

  console.log("\n--- Seeding demo author ---");
  const authorId = await seedAuthor(payload);

  await seedArticles(payload, authorId);

  console.log("\n=== Preview Seed Complete ===");
  console.log("Visit http://localhost:3000/ar (or /fr or /en) to preview.");
  console.log("Run `pnpm seed:preview:reset` before `pnpm migrate:wp` to remove demo data.");
  process.exit(0);
}
```

- [ ] **Step 2: Run the full seed**

Run: `pnpm seed:preview`
Expected: prints `[created] demo-editorial-team` and 18 `[created] demo-<slug>` lines, then `=== Preview Seed Complete ===`, exit 0.

- [ ] **Step 3: Verify row count in DB**

Run: `NODE_PATH="$(pwd)/node_modules/.pnpm/pg@8.20.0/node_modules" node --env-file=.env -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query(\"SELECT count(*)::int as n FROM articles WHERE slug LIKE 'demo-%'\")).then(r=>{console.log('demo articles:',r.rows[0].n);return c.end();})"`
Expected: `demo articles: 18`.

- [ ] **Step 4: Preview in browser**

Run: `curl -s -o /dev/null -w "HTTP %{http_code}\n" -L http://localhost:3000/ar`
Expected: `HTTP 200` and the browser preview at http://localhost:3000/ar shows:
- Hero section with the most recent article (largest daysAgo=0)
- 3 secondary article cards
- NewsSection "Top News" with 6 cards
- NewsSection "Latest News" with remaining cards
- NewsletterStrip at bottom

- [ ] **Step 5: Verify idempotency**

Run `pnpm seed:preview` again.
Expected: all `[skip] demo-<slug>` lines, no `[created]`.

- [ ] **Step 6: Verify reset removes only demo docs**

Run: `pnpm seed:preview:reset`
Expected: 19 `[deleted] ...` lines (18 articles + 1 author), and the seed script's real data (9 categories, 12 competitions, 4 clubs, 4 pages) remains untouched.

Verify seeded structural data is still present:
`NODE_PATH="$(pwd)/node_modules/.pnpm/pg@8.20.0/node_modules" node --env-file=.env -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query(\"SELECT (SELECT count(*)::int FROM categories) cats, (SELECT count(*)::int FROM competitions) comps, (SELECT count(*)::int FROM clubs) clubs, (SELECT count(*)::int FROM articles) arts, (SELECT count(*)::int FROM authors) auths\")).then(r=>{console.log(r.rows[0]);return c.end();})"`
Expected: `{ cats: 9, comps: 12, clubs: 4, arts: 0, auths: 0 }`.

- [ ] **Step 7: Re-seed for final state**

Run: `pnpm seed:preview`
Expected: author + 18 articles recreated, ready for browser preview.

- [ ] **Step 8: Commit**

```bash
git add scripts/seed-preview.ts
git commit -m "feat: seed 18 multilingual demo articles for layout preview"
```

---

## Self-Review

**1. Spec coverage:**
- "work the layout of pages" — no UI changes needed; layout is fully implemented. Confirmed.
- "have a preview of the home page" — Task 3 Step 4 verifies the hero + secondary + news sections render with data.
- "layout of what will be displayed" — covers homepage + articles list + category pages + article detail (all use the same `getArticles` query with `status=published` filter).
- "ready setup to display the articles when we migrate them" — Task 3 Step 6 proves reset leaves categories/competitions/clubs/pages untouched for the real WP migration.

**2. Placeholder scan:**
- No TBD, TODO, "fill in", "similar to", or hand-wave steps. Every code block is complete and copy-pasteable.
- `DEMO_ARTICLES` is the full 18-entry dataset with real translations in all 3 locales.

**3. Type consistency:**
- `DEMO_PREFIX = "demo-"` used identically in `resetDemo`, `seedAuthor`, `seedArticles`.
- `Payload` type alias reused across helpers.
- `authorId: string | number` typed consistently from `seedAuthor` return → `seedArticles` param.
- `lexicalParagraph` signature matches Lexical JSON shape expected by Payload's richText field (verified against [scripts/seed.ts:23-53](../../../scripts/seed.ts)).

**4. Risk check:**
- All demo docs use `demo-` slug prefix → WP migration script ([scripts/migrate-wp.ts](../../../scripts/migrate-wp.ts)) imports real WP slugs which won't collide.
- Reset only touches `LIKE 'demo-%'` slugs, leaving production seed and future migrated articles intact.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-preview-content.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
