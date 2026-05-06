import type { CollectionConfig } from "payload";

export const Clubs: CollectionConfig = {
  slug: "clubs",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "country", "apiFootballId"],
  },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    { name: "slug", type: "text", required: true, unique: true },
    { name: "logo", type: "upload", relationTo: "media" },
    {
      name: "logoUrl",
      type: "text",
      admin: {
        description: "Optional external logo URL fallback (used when 'logo' upload is empty). Useful for seeded preview data referencing API-Football's CDN.",
      },
    },
    {
      name: "apiFootballId",
      type: "number",
      unique: true,
      admin: { description: "Team ID from API-Football" },
    },
    { name: "competitions", type: "relationship", relationTo: "competitions", hasMany: true },
    { name: "venue", type: "text", localized: true },
    { name: "country", type: "text" },
  ],
};
