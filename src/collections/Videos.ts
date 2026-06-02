import type { CollectionConfig } from "payload";

export const Videos: CollectionConfig = {
  slug: "videos",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "playlist", "publishedAt"],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "youtubeId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "The 11-character YouTube video ID." },
    },
    {
      name: "playlist",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "الشوط الثالث", value: "the-third-half" },
        { label: "من الملاعب الرياضية", value: "from-the-stadiums" },
      ],
    },
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "thumbnailUrl",
      type: "text",
      required: true,
    },
    {
      name: "duration",
      type: "text",
    },
    {
      name: "publishedAt",
      type: "date",
    },
    {
      name: "sortOrder",
      type: "number",
      defaultValue: 0,
      admin: { description: "Lower = earlier. Set from playlist order on sync." },
    },
  ],
};
