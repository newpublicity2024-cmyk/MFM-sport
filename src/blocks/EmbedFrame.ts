import type { Block } from "payload";
import { isAllowedIframeSrc } from "@/lib/embeds/iframeAllowlist";

const SRC_REJECTION_MESSAGE: Record<"en" | "fr" | "ar", string> = {
  en: "This link isn't allowed. Allowed sources: Datawrapper, Google Maps, SoundCloud, Spotify.",
  fr: "Ce lien n'est pas autorisé. Sources autorisées : Datawrapper, Google Maps, SoundCloud, Spotify.",
  ar: "هذا الرابط غير مسموح به. المصادر المسموح بها: Datawrapper، خرائط Google، SoundCloud، Spotify.",
};

/**
 * A generic allowlisted iframe: Datawrapper charts, Google Maps, SoundCloud, Spotify.
 * Deliberately not a free-form HTML/iframe block — see the design spec's "No free-form
 * HTML block" section. `src` is checked against `iframeAllowlist.ts`'s exact-hostname
 * allowlist, the same discipline `parseEmbed.ts` uses: exact equality only, never
 * `endsWith`, so `notsoundcloud.com` cannot pass.
 */
export const EmbedFrameBlock: Block = {
  slug: "embedFrame",
  interfaceName: "EmbedFrameBlock",
  labels: {
    singular: { en: "Embedded frame", fr: "Cadre intégré", ar: "إطار مضمّن" },
    plural: { en: "Embedded frames", fr: "Cadres intégrés", ar: "أُطر مضمّنة" },
  },
  fields: [
    {
      name: "src",
      type: "text",
      required: true,
      label: { en: "Embed URL", fr: "URL d'intégration", ar: "رابط التضمين" },
      admin: {
        description: {
          en: "Only links from Datawrapper, Google Maps, SoundCloud or Spotify are accepted.",
          fr: "Seuls les liens Datawrapper, Google Maps, SoundCloud ou Spotify sont acceptés.",
          ar: "لا يُقبل إلا روابط Datawrapper أو خرائط Google أو SoundCloud أو Spotify.",
        },
      },
      validate: (value: unknown) => {
        if (isAllowedIframeSrc(value)) return true;
        return SRC_REJECTION_MESSAGE.ar;
      },
    },
    {
      name: "height",
      type: "number",
      required: true,
      defaultValue: 400,
      label: { en: "Height (pixels)", fr: "Hauteur (pixels)", ar: "الارتفاع (بالبكسل)" },
      admin: {
        description: {
          en: "Frame height in pixels. 400 suits most maps and charts; a SoundCloud player is usually shorter (around 166).",
          fr: "Hauteur du cadre en pixels. 400 convient à la plupart des cartes et graphiques.",
          ar: "ارتفاع الإطار بالبكسل. القيمة 400 تناسب أغلب الخرائط والرسوم البيانية؛ مشغّل SoundCloud عادة أقصر (نحو 166).",
        },
      },
    },
    {
      name: "title",
      type: "text",
      required: true,
      label: { en: "Title (accessibility)", fr: "Titre (accessibilité)", ar: "العنوان (لإمكانية الوصول)" },
      admin: {
        description: {
          en: "Required. Describes the frame's content for screen-reader users — an iframe with no accessible name is unusable with a screen reader. Not shown visually.",
          fr: "Obligatoire. Décrit le contenu du cadre pour les lecteurs d'écran. Non affiché visuellement.",
          ar: "مطلوب. يصف محتوى الإطار لمستخدمي قارئ الشاشة — الإطار بلا اسم واضح لا يمكن استخدامه بقارئ الشاشة. لا يظهر بصريًا.",
        },
      },
    },
  ],
};
