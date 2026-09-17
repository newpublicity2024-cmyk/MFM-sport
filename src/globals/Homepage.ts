import type { GlobalConfig } from "payload";
import { revalidateHomepageChange } from "@/lib/payload/revalidate";

/**
 * Homepage Settings — a single admin-editable document that controls:
 *  - which leagues the hero matches panel lists (one collapsible group each,
 *    the first one open), and
 *  - which tags appear as filter chips on the "latest news" section, and
 *  - which competition fills the matches calendar in the article-page sidebar.
 *
 * The lower matches section has no setting: it is the matches page in
 * miniature (today's games across every listed league, a calendar and a
 * league filter), so it needs nothing chosen for it.
 *
 * Every competition here is a Competitions relationship, never a league id in
 * code. Where one is left empty the site falls back to the competition with
 * the lowest `displayOrder`, so "the league currently playing" is always an
 * edit. The tag list likewise falls back to the tags carried by the latest
 * articles when it is empty.
 *
 * Read is public so the homepage (and its ISR prerender) can load it without auth.
 */
export const Homepage: GlobalConfig = {
  slug: "homepage",
  label: {
    en: "Homepage Settings",
    fr: "Réglages de l'accueil",
    ar: "إعدادات الصفحة الرئيسية",
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [revalidateHomepageChange],
  },
  admin: {
    description: {
      en: "Control which leagues the hero matches panel lists, the tag filters of the latest-news section, and the matches calendar on article pages.",
      fr: "Gérez les championnats du panneau des matchs du hero, les filtres par étiquette de la section « Dernières actualités » et le calendrier des matchs des pages article.",
      ar: "تحكّم في البطولات المعروضة بلوحة مباريات القسم الرئيسي، وفي وسوم تصفية قسم «آخر الأخبار»، وفي روزنامة المباريات بصفحات المقالات.",
    },
  },
  fields: [
    {
      name: "latestNewsTags",
      type: "array",
      label: { en: "Latest news — tag filters", fr: "Dernières actualités — filtres par étiquette", ar: "آخر الأخبار — وسوم التصفية" },
      labels: {
        singular: { en: "Tag", fr: "Étiquette", ar: "وسم" },
        plural: { en: "Tags", fr: "Étiquettes", ar: "وسوم" },
      },
      admin: {
        description: {
          en: "The filter chips beside the 'Latest news' title, in order. Selecting a chip shows that tag's newest articles. Leave empty to show the tags carried by the latest articles.",
          fr: "Les puces de filtre à côté du titre « Dernières actualités », dans l'ordre. Sélectionner une puce affiche les derniers articles de cette étiquette. Laissez vide pour afficher les étiquettes des derniers articles.",
          ar: "أزرار التصفية بجانب عنوان «آخر الأخبار» بالترتيب. اختيار زر يعرض أحدث مقالات ذلك الوسم. اتركه فارغًا لعرض وسوم أحدث المقالات.",
        },
      },
      fields: [
        {
          name: "tag",
          type: "relationship",
          relationTo: "tags",
          required: true,
          label: { en: "Tag", fr: "Étiquette", ar: "الوسم" },
        },
      ],
    },
    {
      name: "heroMatches",
      type: "group",
      label: { en: "Hero matches panel", fr: "Panneau des matchs (hero)", ar: "لوحة مباريات القسم الرئيسي" },
      fields: [
        {
          name: "leagues",
          type: "array",
          label: { en: "Leagues", fr: "Championnats", ar: "البطولات" },
          labels: {
            singular: { en: "League", fr: "Championnat", ar: "بطولة" },
            plural: { en: "Leagues", fr: "Championnats", ar: "بطولات" },
          },
          admin: {
            description: {
              en: "One collapsible group per league, in this order; the first one starts open. Each shows the league's live, recent and upcoming fixtures. Leave empty to use the competition with the lowest display order.",
              fr: "Un groupe repliable par championnat, dans cet ordre ; le premier est ouvert au chargement. Chacun affiche les matchs en direct, récents et à venir. Laissez vide pour utiliser la compétition dont l'ordre d'affichage est le plus petit.",
              ar: "مجموعة قابلة للطيّ لكل بطولة بهذا الترتيب؛ الأولى تكون مفتوحة عند التحميل. تعرض كل مجموعة مباريات البطولة المباشرة والأخيرة والقادمة. اتركه فارغًا لاستخدام البطولة ذات أصغر ترتيب عرض.",
            },
          },
          fields: [
            {
              name: "competition",
              type: "relationship",
              relationTo: "competitions",
              required: true,
              label: { en: "Competition", fr: "Compétition", ar: "البطولة" },
            },
          ],
        },
      ],
    },
    {
      name: "articleMatches",
      type: "group",
      label: {
        en: "Article page — matches sidebar",
        fr: "Page article — colonne des matchs",
        ar: "صفحة المقال — عمود المباريات",
      },
      admin: {
        description: {
          en: "The matches calendar in the right rail of every article page.",
          fr: "Le calendrier des matchs dans la colonne de droite de chaque page article.",
          ar: "روزنامة المباريات في العمود الأيمن لكل صفحة مقال.",
        },
      },
      fields: [
        {
          name: "enabled",
          type: "checkbox",
          defaultValue: true,
          label: { en: "Show the calendar", fr: "Afficher le calendrier", ar: "إظهار الروزنامة" },
        },
        {
          name: "competition",
          type: "relationship",
          relationTo: "competitions",
          label: { en: "Competition", fr: "Compétition", ar: "البطولة" },
          admin: {
            condition: (_, siblingData) => siblingData?.enabled !== false,
            description: {
              en: "Its upcoming fixtures fill the calendar, and its name is the card's heading. Leave empty to use the competition with the lowest display order.",
              fr: "Ses prochains matchs remplissent le calendrier et son nom sert de titre. Laissez vide pour utiliser la compétition dont l'ordre d'affichage est le plus petit.",
              ar: "تملأ مبارياتها القادمة الروزنامة، ويكون اسمها عنوان البطاقة. اتركه فارغًا لاستخدام البطولة ذات أصغر ترتيب عرض.",
            },
          },
        },
      ],
    },
  ],
};
