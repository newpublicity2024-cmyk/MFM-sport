import type { CollectionConfig } from "payload";

export const Competitions: CollectionConfig = {
  slug: "competitions",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "type", "country", "apiFootballId"],
  },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    { name: "slug", type: "text", required: true, unique: true },
    { name: "logo", type: "upload", relationTo: "media" },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "League", value: "league" },
        { label: "Cup", value: "cup" },
      ],
    },
    { name: "country", type: "text" },
    {
      name: "apiFootballId",
      type: "number",
      required: true,
      unique: true,
      admin: { description: "League ID from API-Football (e.g., 39 for Premier League)" },
    },
    {
      name: "season",
      type: "number",
      required: true,
      defaultValue: 2025,
      admin: { description: "Current season year (e.g., 2025 for 2025-26)" },
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "categories",
      admin: { description: "Links this competition to a news category for article filtering" },
    },
  ],
};
