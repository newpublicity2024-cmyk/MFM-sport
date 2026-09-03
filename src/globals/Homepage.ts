import type { GlobalConfig } from "payload";
import { revalidateHomepageChange } from "@/lib/payload/revalidate";

/**
 * Homepage Settings — a single admin-editable document that controls:
 *  - the news-by-league filter (which pills appear, in what order, and which
 *    Tag sources each pill's articles), and
 *  - which competition's matches show in the hero panel and the lower matches
 *    section, and
 *  - which competition fills the matches calendar in the article-page sidebar.
 *
 * Every one of those is a Competitions relationship, never a league id in code.
 * Where one is left empty the site falls back to the competition with the
 * lowest `displayOrder`, so "the league currently playing" is always an edit.
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
      en: "Control the homepage news filter, which matches show in the hero and lower match sections, and the matches calendar on article pages.",
      fr: "Gérez le filtre d'actualités de l'accueil, les matchs affichés dans le hero et la section des matchs, et le calendrier des matchs des pages article.",
      ar: "تحكّم في فلتر أخبار الصفحة الرئيسية، وفي المباريات المعروضة في القسم الرئيسي وقسم المباريات السفلي، وفي روزنامة المباريات بصفحات المقالات.",
    },
  },
  fields: [
    {
      name: "newsFilters",
      type: "array",
      label: { en: "News filter", fr: "Filtre d'actualités", ar: "فلتر الأخبار" },
      labels: {
        singular: { en: "Filter item", fr: "Élément de filtre", ar: "عنصر الفلتر" },
        plural: { en: "Filter items", fr: "Éléments de filtre", ar: "عناصر الفلتر" },
      },
      admin: {
        description: {
          en: "The pills in the 'News by league' section, top to bottom. Each pill shows a competition's crest/name and lists articles carrying the chosen tag.",
          fr: "Les pastilles de la section « Actualités par compétition », de haut en bas. Chaque pastille affiche le logo/nom d'une compétition et liste les articles portant l'étiquette choisie.",
          ar: "أزرار قسم «الأخبار حسب البطولة» من الأعلى للأسفل. كل زر يعرض شعار/اسم بطولة ويُظهر المقالات التي تحمل الوسم المختار.",
        },
      },
      fields: [
        {
          name: "competition",
          type: "relationship",
          relationTo: "competitions",
          required: true,
          label: { en: "Competition", fr: "Compétition", ar: "البطولة" },
          admin: {
            description: {
              en: "Provides the pill's crest and name.",
              fr: "Fournit le logo et le nom de la pastille.",
              ar: "يوفّر شعار الزر واسمه.",
            },
          },
        },
        {
          name: "tag",
          type: "relationship",
          relationTo: "tags",
          label: { en: "News tag", fr: "Étiquette d'actualités", ar: "وسم الأخبار" },
          admin: {
            description: {
              en: "Articles with this tag fill this tab. If empty (or none yet), the tab falls back to the competition's linked category.",
              fr: "Les articles portant cette étiquette remplissent cet onglet. Si vide (ou aucun pour l'instant), l'onglet utilise la catégorie liée à la compétition.",
              ar: "تظهر المقالات التي تحمل هذا الوسم في هذا التبويب. إذا تُرك فارغًا (أو لا توجد مقالات بعد) يعود التبويب إلى التصنيف المرتبط بالبطولة.",
            },
          },
        },
      ],
    },
    {
      name: "heroMatches",
      type: "group",
      label: { en: "Hero matches panel", fr: "Panneau des matchs (hero)", ar: "لوحة مباريات القسم الرئيسي" },
      fields: [
        {
          name: "competition",
          type: "relationship",
          relationTo: "competitions",
          label: { en: "Competition", fr: "Compétition", ar: "البطولة" },
          admin: {
            description: {
              en: "Its fixtures (finished, live, upcoming) fill the hero matches panel. Leave empty to use the competition with the lowest display order.",
              fr: "Ses matchs (terminés, en direct, à venir) remplissent le panneau du hero. Laissez vide pour utiliser la compétition dont l'ordre d'affichage est le plus petit.",
              ar: "تملأ مبارياتها (المنتهية والمباشرة والقادمة) لوحة المباريات في القسم الرئيسي. اتركه فارغًا لاستخدام البطولة ذات أصغر ترتيب عرض.",
            },
          },
        },
      ],
    },
    {
      name: "homeMatches",
      type: "group",
      label: { en: "Lower matches section", fr: "Section des matchs (bas de page)", ar: "قسم المباريات السفلي" },
      fields: [
        {
          name: "mode",
          type: "select",
          required: true,
          defaultValue: "today",
          label: { en: "Source", fr: "Source", ar: "المصدر" },
          options: [
            {
              label: {
                en: "Today's matches across all my leagues",
                fr: "Les matchs du jour de toutes mes compétitions",
                ar: "مباريات اليوم من كل بطولاتي",
              },
              value: "today",
            },
            {
              label: {
                en: "A specific competition",
                fr: "Une compétition précise",
                ar: "بطولة محدّدة",
              },
              value: "competition",
            },
          ],
        },
        {
          name: "competition",
          type: "relationship",
          relationTo: "competitions",
          label: { en: "Competition", fr: "Compétition", ar: "البطولة" },
          admin: {
            condition: (_, siblingData) => siblingData?.mode === "competition",
            description: {
              en: "Shown when Source is 'A specific competition'.",
              fr: "Affiché quand la source est « Une compétition précise ».",
              ar: "يظهر عندما يكون المصدر «بطولة محدّدة».",
            },
          },
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
