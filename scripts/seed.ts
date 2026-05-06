/**
 * MFM Sport — Initial Content Seed
 *
 * Usage:
 *   pnpm seed
 *
 * Requires:
 *   - DATABASE_URL, PAYLOAD_SECRET in .env
 *   - Database migrated (`pnpm payload migrate` already run)
 *   - An admin user exists (create one at /admin before running)
 *
 * What it seeds (per SETUP_CHECKLIST.md):
 *   1. Categories — Arabic taxonomy matching old site
 *   2. Competitions — 12 leagues with API-Football IDs + logoUrl
 *   3. Clubs — Moroccan top-tier clubs with API-Football IDs + logoUrl
 *   4. Pages — 4 static pages (about/contact/legal/privacy) with real Arabic content
 *
 * Idempotent: safe to re-run. Skips or updates anything that already exists by slug.
 */

import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";

type Payload = Awaited<ReturnType<typeof getPayload>>;

function paragraphBody(paragraphs: string[], direction: "ltr" | "rtl" = "rtl") {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction,
      children: paragraphs.map((text) => ({
        type: "paragraph",
        format: "",
        indent: 0,
        version: 1,
        direction,
        children: [
          { type: "text", text, format: 0, style: "", mode: "normal", detail: 0, version: 1 },
        ],
      })),
    },
  };
}

async function findBySlug(
  payload: Payload,
  collection: "categories" | "competitions" | "clubs" | "pages",
  slug: string
) {
  const res = await payload.find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  });
  return res.docs[0];
}

async function seedCategories(payload: Payload) {
  console.log("\n--- Seeding Categories ---");

  const topLevel = [
    { name: "البطولة", slug: "el-botola" },
    { name: "القارية", slug: "continental" },
    { name: "أوروبا", slug: "europe" },
    { name: "كأس العالم 2026", slug: "world-cup-2026" },
  ];

  const parentMap = new Map<string, string | number>();
  for (const c of topLevel) {
    const existing = await findBySlug(payload, "categories", c.slug);
    if (existing) {
      parentMap.set(c.slug, existing.id);
      console.log(`  [skip] ${c.name} (${c.slug})`);
      continue;
    }
    const created = await payload.create({
      collection: "categories",
      data: { name: c.name, slug: c.slug },
      locale: "ar",
      overrideAccess: true,
    });
    parentMap.set(c.slug, created.id);
    console.log(`  [created] ${c.name} (${c.slug})`);
  }

  const children = [
    { name: "البطولة الاحترافية 1", slug: "botola-pro-1-cat", parent: "el-botola" },
    { name: "كأس أفريقيا", slug: "africa-cup-of-nations-cat", parent: "continental" },
    { name: "دوري أبطال أفريقيا", slug: "caf-champions-league-cat", parent: "continental" },
    { name: "الدوري الإنجليزي", slug: "premier-league-cat", parent: "europe" },
    { name: "الدوري الإسباني", slug: "la-liga-cat", parent: "europe" },
  ];

  for (const c of children) {
    const existing = await findBySlug(payload, "categories", c.slug);
    if (existing) {
      console.log(`  [skip] ${c.name} (${c.slug})`);
      continue;
    }
    await payload.create({
      collection: "categories",
      data: {
        name: c.name,
        slug: c.slug,
        parent: parentMap.get(c.parent) as any,
      },
      locale: "ar",
      overrideAccess: true,
    });
    console.log(`  [created] ${c.name} (${c.slug})`);
  }
}

async function seedCompetitions(payload: Payload) {
  console.log("\n--- Seeding Competitions ---");

  const competitions: Array<{
    name: string;
    slug: string;
    type: "league" | "cup";
    apiFootballId: number;
    season: number;
    country?: string;
    categorySlug?: string;
  }> = [
    { name: "Botola Pro 1", slug: "botola-pro-1", type: "league", apiFootballId: 200, season: 2025, country: "Morocco", categorySlug: "botola-pro-1-cat" },
    { name: "CAF Champions League", slug: "caf-champions-league", type: "cup", apiFootballId: 12, season: 2025, categorySlug: "caf-champions-league-cat" },
    { name: "CAF Confederation Cup", slug: "caf-confederation-cup", type: "cup", apiFootballId: 20, season: 2025 },
    { name: "Africa Cup of Nations", slug: "africa-cup-of-nations", type: "cup", apiFootballId: 6, season: 2025, categorySlug: "africa-cup-of-nations-cat" },
    { name: "FIFA World Cup 2026", slug: "world-cup-2026-competition", type: "cup", apiFootballId: 1, season: 2026, categorySlug: "world-cup-2026" },
    { name: "Premier League", slug: "premier-league", type: "league", apiFootballId: 39, season: 2025, country: "England", categorySlug: "premier-league-cat" },
    { name: "La Liga", slug: "la-liga", type: "league", apiFootballId: 140, season: 2025, country: "Spain", categorySlug: "la-liga-cat" },
    { name: "Bundesliga", slug: "bundesliga", type: "league", apiFootballId: 78, season: 2025, country: "Germany" },
    { name: "Serie A", slug: "serie-a", type: "league", apiFootballId: 135, season: 2025, country: "Italy" },
    { name: "Ligue 1", slug: "ligue-1", type: "league", apiFootballId: 61, season: 2025, country: "France" },
    { name: "UEFA Champions League", slug: "uefa-champions-league", type: "cup", apiFootballId: 2, season: 2025 },
    { name: "UEFA Europa League", slug: "uefa-europa-league", type: "cup", apiFootballId: 3, season: 2025 },
  ];

  for (const c of competitions) {
    const existing = await findBySlug(payload, "competitions", c.slug);
    if (existing) {
      if (!(existing as any).logoUrl) {
        await payload.update({
          collection: "competitions",
          id: existing.id,
          data: { logoUrl: `https://media.api-sports.io/football/leagues/${c.apiFootballId}.png` },
          overrideAccess: true,
        });
        console.log(`  [updated logoUrl] ${c.name}`);
      } else {
        console.log(`  [skip] ${c.name}`);
      }
      continue;
    }

    let categoryId: string | number | undefined;
    if (c.categorySlug) {
      const cat = await findBySlug(payload, "categories", c.categorySlug);
      categoryId = cat?.id;
    }

    await payload.create({
      collection: "competitions",
      data: {
        name: c.name,
        slug: c.slug,
        type: c.type,
        apiFootballId: c.apiFootballId,
        season: c.season,
        country: c.country,
        category: categoryId as any,
        logoUrl: `https://media.api-sports.io/football/leagues/${c.apiFootballId}.png`,
      },
      locale: "ar",
      overrideAccess: true,
    });
    console.log(`  [created] ${c.name}`);
  }
}

async function seedClubs(payload: Payload) {
  console.log("\n--- Seeding Clubs ---");

  const botola = await findBySlug(payload, "competitions", "botola-pro-1");

  const clubs: Array<{
    name: string;
    slug: string;
    apiFootballId: number;
    country: string;
    venue?: string;
    logoUrl: string;
  }> = [
    { name: "Wydad AC", slug: "wydad-ac", apiFootballId: 965, country: "Morocco", venue: "Stade Mohammed V", logoUrl: "https://media.api-sports.io/football/teams/965.png" },
    { name: "Raja CA", slug: "raja-ca", apiFootballId: 967, country: "Morocco", venue: "Stade Mohammed V", logoUrl: "https://media.api-sports.io/football/teams/967.png" },
    { name: "FAR Rabat", slug: "far-rabat", apiFootballId: 973, country: "Morocco", venue: "Stade El Bachir", logoUrl: "https://media.api-sports.io/football/teams/973.png" },
    { name: "RS Berkane", slug: "rs-berkane", apiFootballId: 981, country: "Morocco", venue: "Stade Municipal de Berkane", logoUrl: "https://media.api-sports.io/football/teams/981.png" },
  ];

  for (const c of clubs) {
    const existing = await findBySlug(payload, "clubs", c.slug);
    if (existing) {
      if (!(existing as any).logoUrl) {
        await payload.update({
          collection: "clubs",
          id: existing.id,
          data: { logoUrl: c.logoUrl },
          overrideAccess: true,
        });
        console.log(`  [updated logoUrl] ${c.name}`);
      } else {
        console.log(`  [skip] ${c.name}`);
      }
      continue;
    }
    await payload.create({
      collection: "clubs",
      data: {
        name: c.name,
        slug: c.slug,
        apiFootballId: c.apiFootballId,
        country: c.country,
        venue: c.venue,
        logoUrl: c.logoUrl,
        competitions: botola ? [botola.id as any] : [],
      },
      locale: "ar",
      overrideAccess: true,
    });
    console.log(`  [created] ${c.name}`);
  }
}

async function seedPages(payload: Payload) {
  console.log("\n--- Seeding Pages ---");

  const aboutBody = [
    "MFM Sport هي بوابة مغربية متخصصة في كرة القدم، تقدم تغطية شاملة لأخبار البطولة الوطنية، المنتخبات المغربية والأفريقية، والدوريات الأوروبية الكبرى.",
    "نهدف إلى تقديم محتوى تحريري عميق ومحدث لحظة بلحظة، مع تركيز خاص على الكرة المغربية وإنجازات أسود الأطلس.",
    "فريقنا التحريري يعمل على مدار الساعة لتزويدكم بأحدث الأخبار، التحليلات، والإحصائيات من ملاعب كرة القدم حول العالم.",
  ];

  const contactBody = [
    "للتواصل مع فريق التحرير: editorial@mfmsport.ma",
    "للإعلان والشراكات: ads@mfmsport.ma",
    "نرحب بمساهماتكم وأفكاركم. تابعونا أيضاً على شبكاتنا الاجتماعية للتفاعل المباشر.",
  ];

  const legalBody = [
    "جميع المحتويات المنشورة على موقع MFM Sport محمية بموجب قوانين الملكية الفكرية المغربية والدولية.",
    "يحظر إعادة نشر أي محتوى دون إذن خطي مسبق من إدارة الموقع.",
    "MFM Sport غير مسؤولة عن محتوى المواقع الخارجية المرتبطة عبر روابط من هذا الموقع.",
  ];

  const privacyBody = [
    "نحترم خصوصيتكم. لا نجمع بياناتكم الشخصية إلا عند الاشتراك في النشرة الإخبارية أو التواصل معنا.",
    "نستخدم ملفات تعريف الارتباط (cookies) لتحسين تجربة التصفح وقياس أداء الموقع عبر Google Analytics وVercel Analytics.",
    "يمكنكم طلب حذف بياناتكم في أي وقت عبر التواصل على privacy@mfmsport.ma.",
  ];

  const pages: Array<{ title: string; slug: string; body: string[] }> = [
    { title: "من نحن", slug: "about", body: aboutBody },
    { title: "اتصل بنا", slug: "contact", body: contactBody },
    { title: "إشعار قانوني", slug: "legal", body: legalBody },
    { title: "سياسة الخصوصية", slug: "privacy", body: privacyBody },
  ];

  for (const p of pages) {
    const existing = await findBySlug(payload, "pages", p.slug);
    if (existing) {
      await payload.update({
        collection: "pages",
        id: existing.id,
        data: { body: paragraphBody(p.body, "rtl") as any },
        locale: "ar",
        overrideAccess: true,
      });
      console.log(`  [updated body] ${p.title}`);
      continue;
    }
    await payload.create({
      collection: "pages",
      data: { title: p.title, slug: p.slug, body: paragraphBody(p.body, "rtl") as any },
      locale: "ar",
      overrideAccess: true,
    });
    console.log(`  [created] ${p.title}`);
  }
}

async function main() {
  console.log("=== MFM Sport Content Seed ===");

  const payload = await getPayload({ config });

  const userCount = await payload.count({ collection: "users", overrideAccess: true });
  if (userCount.totalDocs === 0) {
    console.error("\n❌ No admin user exists. Visit http://localhost:3000/admin first and create an admin account, then re-run this script.");
    process.exit(1);
  }

  await seedCategories(payload);
  await seedCompetitions(payload);
  await seedClubs(payload);
  await seedPages(payload);

  console.log("\n=== Seed Complete ===");
  console.log("Next: run `pnpm migrate:wp` to import WordPress articles, or add Authors / Editors via /admin.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
