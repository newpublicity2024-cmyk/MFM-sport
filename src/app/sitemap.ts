import type { MetadataRoute } from "next";
import { getPayload } from "payload";
import configPromise from "@payload-config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mfmsport.ma";
const LOCALES = ["ar", "fr", "en"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config: configPromise });
  const entries: MetadataRoute.Sitemap = [];

  // Static pages per locale
  for (const locale of LOCALES) {
    entries.push(
      { url: `${SITE_URL}/${locale}`, lastModified: new Date(), changeFrequency: "hourly", priority: 1.0 },
      { url: `${SITE_URL}/${locale}/articles`, changeFrequency: "hourly", priority: 0.9 },
      { url: `${SITE_URL}/${locale}/matches`, changeFrequency: "hourly", priority: 0.9 },
      { url: `${SITE_URL}/${locale}/videos`, changeFrequency: "daily", priority: 0.7 },
      { url: `${SITE_URL}/${locale}/search`, changeFrequency: "weekly", priority: 0.3 },
      { url: `${SITE_URL}/${locale}/about`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${SITE_URL}/${locale}/contact`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${SITE_URL}/${locale}/legal`, changeFrequency: "monthly", priority: 0.2 },
      { url: `${SITE_URL}/${locale}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    );
  }

  // Articles
  const articles = await payload.find({
    collection: "articles",
    where: { status: { equals: "published" } },
    limit: 50000,
    select: { slug: true, updatedAt: true },
    sort: "-publishedAt",
  });

  for (const article of articles.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/articles/${article.slug}`,
        lastModified: new Date(article.updatedAt),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // Categories
  const categories = await payload.find({
    collection: "categories",
    limit: 500,
    select: { slug: true },
  });

  for (const category of categories.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/category/${category.slug}`,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  // Tags
  const tags = await payload.find({
    collection: "tags",
    limit: 1000,
    select: { slug: true },
  });

  for (const tag of tags.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/tag/${tag.slug}`,
        changeFrequency: "daily",
        priority: 0.5,
      });
    }
  }

  // Authors
  const authors = await payload.find({
    collection: "authors",
    limit: 100,
    select: { slug: true },
  });

  for (const author of authors.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/author/${author.slug}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  // Competitions
  const competitions = await payload.find({
    collection: "competitions",
    limit: 50,
    select: { slug: true },
  });

  for (const comp of competitions.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/competition/${comp.slug}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  }

  // Clubs
  const clubs = await payload.find({
    collection: "clubs",
    limit: 200,
    select: { slug: true },
  });

  for (const club of clubs.docs) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/club/${club.slug}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
