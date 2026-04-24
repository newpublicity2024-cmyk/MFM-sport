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
 *   2. Competitions — 12 leagues with API-Football IDs
 *   3. Clubs — Moroccan top-tier clubs with API-Football IDs
 *   4. Pages — 4 static pages (about/contact/legal/privacy) with placeholder body
 *
 * Idempotent: safe to re-run. Skips anything that already exists by slug.
 */

import "dotenv/config";
import { getPayload } from "payload";
import config from "../src/payload.config";

type Payload = Awaited<ReturnType<typeof getPayload>>;

function placeholderBody(arabicTitle: string) {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: "rtl",
      children: [
        {
          type: "paragraph",
          format: "",
          indent: 0,
          version: 1,
          direction: "rtl",
          children: [
            {
              type: "text",
              text: `${arabicTitle} — محتوى قيد الإعداد.`,
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
      console.log(`  [skip] ${c.name}`);
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
  }> = [
    { name: "Wydad AC", slug: "wydad-ac", apiFootballId: 965, country: "Morocco", venue: "Stade Mohammed V" },
    { name: "Raja CA", slug: "raja-ca", apiFootballId: 967, country: "Morocco", venue: "Stade Mohammed V" },
    { name: "FAR Rabat", slug: "far-rabat", apiFootballId: 973, country: "Morocco", venue: "Stade El Bachir" },
    { name: "RS Berkane", slug: "rs-berkane", apiFootballId: 981, country: "Morocco", venue: "Stade Municipal de Berkane" },
  ];

  for (const c of clubs) {
    const existing = await findBySlug(payload, "clubs", c.slug);
    if (existing) {
      console.log(`  [skip] ${c.name}`);
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

  const pages = [
    { title: "من نحن", slug: "about" },
    { title: "اتصل بنا", slug: "contact" },
    { title: "إشعار قانوني", slug: "legal" },
    { title: "سياسة الخصوصية", slug: "privacy" },
  ];

  for (const p of pages) {
    const existing = await findBySlug(payload, "pages", p.slug);
    if (existing) {
      console.log(`  [skip] ${p.title}`);
      continue;
    }
    await payload.create({
      collection: "pages",
      data: {
        title: p.title,
        slug: p.slug,
        body: placeholderBody(p.title) as any,
      },
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
