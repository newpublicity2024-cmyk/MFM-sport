import type { CollectionConfig } from "payload";

export const Redirects: CollectionConfig = {
  slug: "redirects",
  admin: {
    defaultColumns: ["from", "to", "statusCode"],
    description: "Legacy URL redirects (WordPress migration)",
  },
  fields: [
    {
      name: "from",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Old path (e.g., /%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1-old-slug/)",
      },
    },
    {
      name: "to",
      type: "text",
      required: true,
      admin: {
        description: "New path (e.g., /ar/articles/new-slug)",
      },
    },
    {
      name: "statusCode",
      type: "select",
      required: true,
      defaultValue: "301",
      options: [
        { label: "301 Permanent", value: "301" },
        { label: "302 Temporary", value: "302" },
      ],
    },
  ],
};
