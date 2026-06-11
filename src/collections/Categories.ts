import type { CollectionConfig } from "payload";
import { revalidateCategoryChange, revalidateCategoryDelete } from "@/lib/payload/revalidate";

export const Categories: CollectionConfig = {
  slug: "categories",
  hooks: {
    afterChange: [revalidateCategoryChange],
    afterDelete: [revalidateCategoryDelete],
  },
  admin: {
    useAsTitle: "name",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      localized: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "URL-friendly identifier (ASCII, lowercase, hyphens)",
      },
    },
    {
      name: "parent",
      type: "relationship",
      relationTo: "categories",
      admin: {
        description: "Parent category for hierarchical structure",
      },
    },
    {
      name: "description",
      type: "textarea",
      localized: true,
    },
  ],
};
