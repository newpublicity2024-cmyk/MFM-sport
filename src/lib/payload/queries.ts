import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function getPayloadClient() {
  return getPayload({ config: configPromise });
}

export async function getArticles(options: {
  locale: string;
  page?: number;
  limit?: number;
  sort?: string;
}) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      status: { equals: "published" },
    },
    locale: options.locale,
    page: options.page || 1,
    limit: options.limit || 12,
    sort: options.sort || "-publishedAt",
    depth: 2,
  });
}

export async function getArticleBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "articles",
    where: {
      slug: { equals: slug },
      status: { equals: "published" },
    },
    locale,
    limit: 1,
    depth: 2,
  });
  return result.docs[0] || null;
}

export async function getArticlesByCategory(
  categoryId: string | number,
  locale: string,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      categories: { equals: categoryId },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getArticlesByTag(
  tagId: string | number,
  locale: string,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      tags: { equals: tagId },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getArticlesByAuthor(
  authorId: string | number,
  locale: string,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      author: { equals: authorId },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getRelatedArticles(
  articleId: string | number,
  categoryIds: (string | number)[],
  locale: string,
  limit: number = 4,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      id: { not_equals: articleId },
      categories: { in: categoryIds.map(String) },
      status: { equals: "published" },
    },
    locale,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getCategoryBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "categories",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
  });
  return result.docs[0] || null;
}

export async function getTagBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "tags",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
  });
  return result.docs[0] || null;
}

export async function getAuthorBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "authors",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    depth: 1,
  });
  return result.docs[0] || null;
}

export async function searchArticles(
  query: string,
  locale: string,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      or: [
        { title: { like: query } },
        { excerpt: { like: query } },
      ],
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getCompetitions(locale: string) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "competitions",
    locale,
    limit: 50,
    sort: "name",
    depth: 1,
  });
}

export async function getCompetitionBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "competitions",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    depth: 1,
  });
  return result.docs[0] || null;
}

export async function getClubBySlug(slug: string, locale: string) {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: "clubs",
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    depth: 1,
  });
  return result.docs[0] || null;
}

export async function getArticlesByCompetition(
  competitionCategoryId: string | number,
  locale: string,
  limit: number = 6,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      categories: { equals: competitionCategoryId },
      status: { equals: "published" },
    },
    locale,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}

export async function getVideoArticles(
  locale: string,
  page: number = 1,
  limit: number = 12,
) {
  const payload = await getPayloadClient();
  return payload.find({
    collection: "articles",
    where: {
      isVideo: { equals: true },
      status: { equals: "published" },
    },
    locale,
    page,
    limit,
    sort: "-publishedAt",
    depth: 2,
  });
}
