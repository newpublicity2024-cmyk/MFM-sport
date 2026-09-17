import type { CollectionConfig } from "payload";
import { taxonomySlug } from "@/lib/payload/slugFromTitle";

export const Tags: CollectionConfig = {
  slug: "tags",
  labels: {
    singular: { en: "Tag", fr: "Étiquette", ar: "وسم" },
    plural: { en: "Tags", fr: "Étiquettes", ar: "الوسوم" },
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
    },
  ],
};
