import type { CollectionConfig } from "payload";
import { taxonomySlug } from "@/lib/payload/slugFromTitle";
import { revalidateCategoryChange, revalidateCategoryDelete } from "@/lib/payload/revalidate";

export const Categories: CollectionConfig = {
  slug: "categories",
  labels: {
    singular: { en: "Category", fr: "Catégorie", ar: "تصنيف" },
    plural: { en: "Categories", fr: "Catégories", ar: "التصنيفات" },
  },
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
      label: { en: "Name", fr: "Nom", ar: "الاسم" },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      hooks: {
        // Empty → from the name; whitespace or percent-encoding → repaired; a
        // working slug → kept verbatim. 251 tag and 22 category slugs carried
        // spaces (226 a trailing one) and 404'd from the sitemap; see
        // lib/payload/slugFromTitle and scripts/normalize-taxonomy-slugs.ts.
        beforeValidate: [taxonomySlug],
      },
      label: { en: "Slug", fr: "Identifiant URL", ar: "المعرّف في الرابط" },
      admin: {
        description: {
          en: "URL-friendly identifier (ASCII, lowercase, hyphens)",
          fr: "Identifiant pour l'URL (ASCII, minuscules, tirets)",
          ar: "معرّف صالح للرابط (أحرف لاتينية صغيرة وشرطات)",
        },
      },
    },
    {
      name: "parent",
      type: "relationship",
      relationTo: "categories",
      label: { en: "Parent category", fr: "Catégorie parente", ar: "التصنيف الأب" },
      admin: {
        description: {
          en: "Parent category for hierarchical structure",
          fr: "Catégorie parente pour une structure hiérarchique",
          ar: "التصنيف الأعلى لبناء هيكل هرمي",
        },
      },
    },
    {
      name: "description",
      type: "textarea",
      localized: true,
      label: { en: "Description", fr: "Description", ar: "الوصف" },
    },
  ],
};
