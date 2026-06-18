import type { CollectionConfig } from "payload";
import { revalidateAdChange, revalidateAdDelete } from "@/lib/payload/revalidate";

// Field-level `validate` callbacks get no contextual parameter types in this
// config shape (unlike `admin.condition`), so annotate them explicitly to stay
// strict-mode clean. We only ever read siblingData.type to branch.
type AdFieldValidateOptions = { siblingData?: { type?: string | null } | null };

// The ad placement slots. Keep these values in sync with
// AdPlacement in src/lib/payload/ads.ts.
export const AD_PLACEMENTS = [
  {
    label: {
      en: "Home — Top banner (above hero)",
      fr: "Accueil — Bannière supérieure (au-dessus du hero)",
      ar: "الرئيسية — البانر العلوي (فوق القسم الرئيسي)",
    },
    value: "top-banner",
  },
  {
    label: {
      en: "Home — Between hero & news",
      fr: "Accueil — Entre le hero et les actualités",
      ar: "الرئيسية — بين القسم الرئيسي والأخبار",
    },
    value: "hero-news",
  },
  {
    label: {
      en: "Home — Between news & videos",
      fr: "Accueil — Entre les actualités et les vidéos",
      ar: "الرئيسية — بين الأخبار والفيديو",
    },
    value: "news-videos",
  },
  {
    label: {
      en: "Home — Between videos & matches",
      fr: "Accueil — Entre les vidéos et les matchs",
      ar: "الرئيسية — بين الفيديو والمباريات",
    },
    value: "videos-matches",
  },
  {
    label: {
      en: "News card (blog-sized, in the news grid)",
      fr: "Carte d'actualité (format blog, dans la grille d'actualités)",
      ar: "بطاقة خبر (بحجم المقال، ضمن شبكة الأخبار)",
    },
    value: "news-card",
  },
  {
    label: {
      en: "Article page — Side rail (vertical 300×600)",
      fr: "Page d'article — Colonne latérale (vertical 300×600)",
      ar: "صفحة المقال — الشريط الجانبي (عمودي 300×600)",
    },
    value: "article-sidebar",
  },
] as const;

export const Ads: CollectionConfig = {
  slug: "ads",
  labels: {
    singular: { en: "Ad", fr: "Publicité", ar: "إعلان" },
    plural: { en: "Ads", fr: "Publicités", ar: "الإعلانات" },
  },
  hooks: {
    afterChange: [revalidateAdChange],
    afterDelete: [revalidateAdDelete],
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "type", "placement", "active", "order"],
    description: {
      en: "Each row is one ad creative. Multiple ads sharing a placement rotate as a slider in that slot.",
      fr: "Chaque ligne est une création publicitaire. Plusieurs publicités partageant un emplacement défilent en diaporama dans cet espace.",
      ar: "كل صف هو إعلان واحد. تتناوب الإعلانات التي تشترك في نفس الموضع كشريط متحرك في تلك المساحة.",
    },
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: { en: "Name", fr: "Nom", ar: "الاسم" },
      admin: {
        description: {
          en: "Internal label (e.g. 'OCP SIAM — June').",
          fr: "Libellé interne (ex. : « OCP SIAM — Juin »).",
          ar: "تسمية داخلية (مثال: «OCP SIAM — يونيو»).",
        },
      },
    },
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "image",
      label: { en: "Type", fr: "Type", ar: "النوع" },
      options: [
        {
          label: {
            en: "Image upload (static creative we host)",
            fr: "Image téléversée (création statique hébergée par nous)",
            ar: "صورة مرفوعة (إعلان ثابت نستضيفه)",
          },
          value: "image",
        },
        {
          label: {
            en: "Ad-manager tag (embed code — network fills the slot)",
            fr: "Balise de régie (code d'intégration — la régie remplit l'espace)",
            ar: "وسم شبكة إعلانات (كود تضمين — الشبكة تملأ المساحة)",
          },
          value: "tag",
        },
      ],
      admin: {
        description: {
          en: "Image = upload a creative. Ad-manager tag = paste an embed snippet from your network (Google Ad Manager, AdSense, etc.) and it fills the slot automatically.",
          fr: "Image = téléversez une création. Balise de régie = collez un extrait d'intégration de votre régie (Google Ad Manager, AdSense, etc.) qui remplit l'espace automatiquement.",
          ar: "صورة = ارفع تصميمًا. وسم شبكة الإعلانات = الصق كود التضمين من شبكتك (Google Ad Manager أو AdSense وغيرها) فيملأ المساحة تلقائيًا.",
        },
      },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      label: { en: "Image", fr: "Image", ar: "الصورة" },
      admin: {
        condition: (_, siblingData) => siblingData?.type !== "tag",
        description: {
          en: "Banners: design ~1600×376 (wide). News cards: design 16:9 (e.g. 600×400). Article side rail: design 300×600 (vertical). Only used for Image-type ads.",
          fr: "Bannières : concevez ~1600×376 (large). Cartes d'actualité : format 16:9 (ex. : 600×400). Colonne d'article : 300×600 (vertical). Utilisé uniquement pour les publicités de type Image.",
          ar: "البانرات: صمّم بمقاس ~1600×376 (عريض). بطاقات الأخبار: بنسبة 16:9 (مثال 600×400). الشريط الجانبي للمقال: 300×600 (عمودي). يُستخدم فقط لإعلانات نوع الصورة.",
        },
      },
      validate: (value: unknown, { siblingData }: AdFieldValidateOptions) => {
        const t = siblingData?.type;
        if (t !== "tag" && !value) return "An image is required for image-type ads.";
        return true;
      },
    },
    {
      name: "embedCode",
      type: "textarea",
      label: { en: "Embed code", fr: "Code d'intégration", ar: "كود التضمين" },
      admin: {
        condition: (_, siblingData) => siblingData?.type === "tag",
        description: {
          en: "Paste the full ad snippet from your network (the <ins>/<script> code). It runs as-is and the network fills the slot. Leave Image empty for tag ads.",
          fr: "Collez l'extrait publicitaire complet de votre régie (le code <ins>/<script>). Il s'exécute tel quel et la régie remplit l'espace. Laissez le champ Image vide pour les balises.",
          ar: "الصق كود الإعلان الكامل من شبكتك (وسوم <ins>/<script>). يعمل كما هو وتملأ الشبكة المساحة. اترك حقل الصورة فارغًا لإعلانات الوسم.",
        },
      },
      validate: (value: unknown, { siblingData }: AdFieldValidateOptions) => {
        const t = siblingData?.type;
        if (t === "tag" && (typeof value !== "string" || !value.trim())) {
          return "Paste the ad-manager embed code for tag-type ads.";
        }
        return true;
      },
    },
    {
      name: "linkUrl",
      type: "text",
      label: { en: "Link URL", fr: "URL du lien", ar: "رابط الإعلان" },
      admin: {
        description: {
          en: "Optional. Clicking the ad opens this in a new tab.",
          fr: "Facultatif. Un clic sur la publicité ouvre ce lien dans un nouvel onglet.",
          ar: "اختياري. النقر على الإعلان يفتح هذا الرابط في تبويب جديد.",
        },
      },
    },
    {
      name: "placement",
      type: "select",
      required: true,
      index: true,
      label: { en: "Placement", fr: "Emplacement", ar: "الموضع" },
      options: [...AD_PLACEMENTS],
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      index: true,
      label: { en: "Active", fr: "Actif", ar: "مُفعّل" },
      admin: {
        description: {
          en: "Uncheck to hide without deleting.",
          fr: "Décochez pour masquer sans supprimer.",
          ar: "أزل العلامة للإخفاء دون حذف.",
        },
      },
    },
    {
      name: "order",
      type: "number",
      defaultValue: 0,
      label: { en: "Order", fr: "Ordre", ar: "الترتيب" },
      admin: {
        description: {
          en: "Lower shows first in the slider rotation.",
          fr: "Plus petit = affiché en premier dans le diaporama.",
          ar: "الأصغر يظهر أولًا في تتابع الشريط المتحرك.",
        },
      },
    },
  ],
};
