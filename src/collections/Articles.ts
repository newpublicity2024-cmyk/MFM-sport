import type { CollectionConfig } from "payload";
import { revalidateArticleChange, revalidateArticleDelete } from "@/lib/payload/revalidate";
import { slugFromTitle } from "@/lib/payload/slugFromTitle";

export const Articles: CollectionConfig = {
  slug: "articles",
  hooks: {
    afterChange: [revalidateArticleChange],
    afterDelete: [revalidateArticleDelete],
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "status", "author", "publishedAt"],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      localized: true,
      index: true,
      hooks: {
        // Auto-generate from this locale's title (spaces → dashes) when left
        // empty. Keeps any explicitly-set slug, so existing URLs aren't rewritten.
        beforeValidate: [slugFromTitle],
      },
      admin: {
        readOnly: true,
        description:
          "Auto-generated from the title (spaces become dashes), per language. Leave it blank — it fills in automatically when you save.",
      },
    },
    {
      name: "excerpt",
      type: "textarea",
      localized: true,
      admin: {
        description: "Short summary for cards and SEO meta description",
      },
    },
    {
      name: "body",
      type: "richText",
      required: true,
      localized: true,
    },
    {
      name: "featuredImage",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "featuredImageUrl",
      type: "text",
      admin: {
        description: "Optional external image URL fallback (used when 'featuredImage' upload is empty). Used for preview seed data.",
      },
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "authors",
      required: true,
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
    },
    {
      name: "tags",
      type: "relationship",
      relationTo: "tags",
      hasMany: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
    },
    {
      name: "isVideo",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Mark as video article (shows YouTube embed)",
      },
    },
    {
      name: "videoUrl",
      type: "text",
      admin: {
        condition: (data) => Boolean(data?.isVideo),
        description: "YouTube video URL (e.g., https://youtube.com/watch?v=...)",
      },
    },
  ],
};
