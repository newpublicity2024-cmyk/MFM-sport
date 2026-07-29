import type { Block } from "payload";

/**
 * An uploaded audio segment (interview, match commentary clip, radio excerpt) plus an
 * optional title. MFM is a radio brand, so this is a real, recurring content type rather
 * than a hypothetical — see also `embedFrame`'s SoundCloud allowlist entry.
 *
 * `file` reuses the `media` collection rather than a separate audio collection: it is
 * uploaded exactly like an image, and `Media.upload.mimeTypes` is extended elsewhere in
 * this task to accept the audio formats journalists actually export.
 */
export const AudioBlock: Block = {
  slug: "audio",
  interfaceName: "AudioBlock",
  labels: {
    singular: { en: "Audio", fr: "Audio", ar: "ملف صوتي" },
    plural: { en: "Audio files", fr: "Fichiers audio", ar: "ملفات صوتية" },
  },
  fields: [
    {
      name: "file",
      type: "upload",
      relationTo: "media",
      required: true,
      label: { en: "Audio file", fr: "Fichier audio", ar: "الملف الصوتي" },
      admin: {
        description: {
          en: "Upload an MP3 the same way you upload a photo. A player appears in the article wherever you place this block.",
          fr: "Téléversez un MP3 comme vous téléversez une image. Un lecteur apparaît dans l'article à l'endroit choisi.",
          ar: "ارفع ملف MP3 بنفس طريقة رفع الصورة. سيظهر مشغّل صوتي داخل المقال في المكان الذي تضع فيه هذا العنصر.",
        },
      },
    },
    {
      name: "title",
      type: "text",
      label: { en: "Title", fr: "Titre", ar: "العنوان" },
      admin: {
        description: {
          en: "Optional — shown above the player, e.g. \"Full post-match interview\".",
          fr: "Facultatif — affiché au-dessus du lecteur.",
          ar: "اختياري — يظهر فوق المشغّل، مثل «المقابلة الكاملة بعد المباراة».",
        },
      },
    },
  ],
};
