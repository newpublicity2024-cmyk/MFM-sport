import type { CollectionConfig, CollectionBeforeChangeHook } from "payload";
import { revalidateArticleChange, revalidateArticleDelete } from "@/lib/payload/revalidate";
import { slugFromTitle } from "@/lib/payload/slugFromTitle";

// When an article is published without an explicit date, stamp it with the
// current time so editors don't have to set it manually. Never overwrites an
// existing date, and drafts stay date-less until published.
const setPublishedAtOnPublish: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const status = data?.status ?? originalDoc?.status;
  const publishedAt = data?.publishedAt ?? originalDoc?.publishedAt;
  if (status === "published" && !publishedAt) {
    return { ...data, publishedAt: new Date().toISOString() };
  }
  return data;
};

export const Articles: CollectionConfig = {
  slug: "articles",
  labels: {
    singular: { en: "Article", fr: "Article", ar: "مقال" },
    plural: { en: "Articles", fr: "Articles", ar: "المقالات" },
  },
  hooks: {
    beforeChange: [setPublishedAtOnPublish],
    afterChange: [revalidateArticleChange],
    afterDelete: [revalidateArticleDelete],
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "status", "author", "publishedAt"],
  },
  fields: [
    // Language tabs (العربية / Français / English). Switches the active content
    // locale so the fields below show that language's version.
    {
      name: "languageTabs",
      type: "ui",
      admin: {
        components: {
          Field: "/components/admin/ArticleLanguageTabs#ArticleLanguageTabs",
        },
      },
    },
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
      label: { en: "Title", fr: "Titre", ar: "العنوان" },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      localized: true,
      index: true,
      label: { en: "Slug", fr: "Identifiant URL", ar: "المعرّف في الرابط" },
      hooks: {
        // Auto-generate from this locale's title (spaces → dashes) when left
        // empty. Keeps any explicitly-set slug, so existing URLs aren't rewritten.
        beforeValidate: [slugFromTitle],
      },
      admin: {
        readOnly: true,
        description: {
          en: "Auto-generated from the title (spaces become dashes), per language. Leave it blank — it fills in automatically when you save.",
          fr: "Généré automatiquement à partir du titre (les espaces deviennent des tirets), par langue. Laissez-le vide — il se remplit tout seul à l'enregistrement.",
          ar: "يُنشأ تلقائيًا من العنوان (تتحوّل المسافات إلى شرطات) لكل لغة. اتركه فارغًا — يُملأ تلقائيًا عند الحفظ.",
        },
      },
    },
    {
      name: "excerpt",
      type: "textarea",
      localized: true,
      label: { en: "Excerpt", fr: "Résumé", ar: "المقتطف" },
      admin: {
        description: {
          en: "Short summary for cards and SEO meta description",
          fr: "Court résumé pour les cartes et la méta-description SEO",
          ar: "ملخّص قصير يظهر في البطاقات ووصف SEO",
        },
      },
    },
    {
      name: "body",
      type: "richText",
      required: true,
      localized: true,
      label: { en: "Body", fr: "Contenu", ar: "المحتوى" },
    },
    {
      name: "featuredImage",
      type: "upload",
      relationTo: "media",
      label: { en: "Featured image", fr: "Image à la une", ar: "الصورة البارزة" },
    },
    {
      name: "featuredImageUrl",
      type: "text",
      // Seed/preview-only fallback — set programmatically, hidden from the editor
      // so the form stays simple.
      admin: {
        hidden: true,
        description: {
          en: "Optional external image URL fallback (used when 'featuredImage' upload is empty). Used for preview seed data.",
          fr: "URL d'image externe de secours (utilisée quand « Image à la une » est vide). Pour les données de prévisualisation.",
          ar: "رابط صورة خارجي احتياطي (يُستخدم عندما يكون حقل «الصورة البارزة» فارغًا). لبيانات المعاينة.",
        },
      },
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "authors",
      required: true,
      label: { en: "Author", fr: "Auteur", ar: "الكاتب" },
      admin: { position: "sidebar" },
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "categories",
      hasMany: true,
      label: { en: "Categories", fr: "Catégories", ar: "التصنيفات" },
      admin: { position: "sidebar" },
    },
    {
      name: "tags",
      type: "relationship",
      relationTo: "tags",
      hasMany: true,
      label: { en: "Tags", fr: "Étiquettes", ar: "الوسوم" },
      admin: { position: "sidebar" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      label: { en: "Status", fr: "Statut", ar: "الحالة" },
      options: [
        { label: { en: "Draft", fr: "Brouillon", ar: "مسودة" }, value: "draft" },
        { label: { en: "Published", fr: "Publié", ar: "منشور" }, value: "published" },
      ],
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "publishedAt",
      type: "date",
      label: { en: "Published at", fr: "Date de publication", ar: "تاريخ النشر" },
      admin: {
        position: "sidebar",
        description: {
          en: "Leave empty — set automatically to now when you publish.",
          fr: "Laissez vide — défini automatiquement à maintenant lors de la publication.",
          ar: "اتركه فارغًا — يُضبط تلقائيًا إلى الوقت الحالي عند النشر.",
        },
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
    },
    {
      name: "isVideo",
      type: "checkbox",
      defaultValue: false,
      label: { en: "Video article", fr: "Article vidéo", ar: "مقال فيديو" },
      admin: {
        position: "sidebar",
        description: {
          en: "Mark as video article (shows YouTube embed)",
          fr: "Marquer comme article vidéo (affiche l'intégration YouTube)",
          ar: "وسمه كمقال فيديو (يعرض تضمين يوتيوب)",
        },
      },
    },
    {
      name: "videoUrl",
      type: "text",
      label: { en: "Video URL", fr: "URL de la vidéo", ar: "رابط الفيديو" },
      admin: {
        position: "sidebar",
        condition: (data) => Boolean(data?.isVideo),
        description: {
          en: "YouTube video URL (e.g., https://youtube.com/watch?v=...)",
          fr: "URL de la vidéo YouTube (ex. : https://youtube.com/watch?v=...)",
          ar: "رابط فيديو يوتيوب (مثال: https://youtube.com/watch?v=...)",
        },
      },
    },
  ],
};
