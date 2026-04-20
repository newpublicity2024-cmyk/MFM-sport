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
