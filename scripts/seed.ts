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

const TRANSLATIONS: Record<string, { fr: string; en: string }> = {
  "el-botola": { fr: "Botola", en: "Botola" },
  "continental": { fr: "Continental", en: "Continental" },
  "europe": { fr: "Europe", en: "Europe" },
  "world-cup-2026": { fr: "Coupe du Monde 2026", en: "World Cup 2026" },
  "botola-pro-1-cat": { fr: "Botola Pro 1", en: "Botola Pro 1" },
  "africa-cup-of-nations-cat": { fr: "CAN", en: "AFCON" },
  "caf-champions-league-cat": { fr: "LDC Afrique", en: "CAF Champions League" },
  "premier-league-cat": { fr: "Premier League", en: "Premier League" },
  "la-liga-cat": { fr: "La Liga", en: "La Liga" },
};

async function updateCategoryLocales(payload: Payload, id: string | number, slug: string) {
  const t = TRANSLATIONS[slug];
  if (!t) return;
  await payload.update({ collection: "categories", id, data: { name: t.fr }, locale: "fr", overrideAccess: true });
  await payload.update({ collection: "categories", id, data: { name: t.en }, locale: "en", overrideAccess: true });
  console.log(`  [localized fr+en] ${slug}`);
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
      await updateCategoryLocales(payload, existing.id, c.slug);
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
    await updateCategoryLocales(payload, created.id, c.slug);
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
      await updateCategoryLocales(payload, existing.id, c.slug);
      continue;
    }
    const created = await payload.create({
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
    await updateCategoryLocales(payload, created.id, c.slug);
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
