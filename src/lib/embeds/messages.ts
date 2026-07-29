/**
 * Journalist-facing messages for every `EmbedFailure` reason `parseEmbed` can return.
 *
 * Single source of truth, exported for reuse — not authored inline inside a `validate()`
 * function, which is exactly how these would end up duplicated the moment a second
 * consumer needs them (Task 5's renderer fallbacks are the obvious next one: a dead
 * embed returns 200 and paints nothing, so the caption-plus-link fallback wants the
 * same wording this module already owns).
 *
 * Arabic is the primary, authored-first content — this is the only locale served to
 * readers (see CLAUDE.md → Conventions), and the journalist writing these articles is
 * Arabic-speaking. `en` and `fr` ride alongside in the same `{ en, fr, ar }` shape used
 * throughout `src/collections/`, because the Payload admin panel itself is available in
 * all three languages (see `src/payload.config.ts` → `i18n.supportedLanguages`).
 *
 * Typed as `Record<EmbedFailure, LocalizedMessage>` deliberately: `EmbedFailure` is
 * imported from `parseEmbed.ts`, the single source of truth for that union, so adding a
 * fifth reason there without adding a matching entry here is a compile error, not a
 * silent gap caught only by luck or a runtime crash.
 */

import type { EmbedFailure } from "./parseEmbed";

export type LocalizedMessage = {
  en: string;
  fr: string;
  ar: string;
};

export const EMBED_FAILURE_MESSAGES: Record<EmbedFailure, LocalizedMessage> = {
  empty: {
    en: "No link was entered.",
    fr: "Aucun lien n'a été saisi.",
    ar: "لم يتم إدخال أي رابط.",
  },
  unsupported: {
    en: "This platform isn't supported. Supported platforms: Facebook, X, Instagram, YouTube.",
    fr: "Cette plateforme n'est pas prise en charge. Plateformes prises en charge : Facebook, X, Instagram, YouTube.",
    ar: "هذه المنصة غير مدعومة. المنصات المدعومة هي: فيسبوك، إكس، إنستغرام، ويوتيوب فقط.",
  },
  "short-link": {
    en: "fb.watch links can't be used — open the link and copy the full URL from the browser's address bar.",
    fr: "Les liens fb.watch ne peuvent pas être utilisés — ouvrez le lien et copiez l'URL complète depuis la barre d'adresse du navigateur.",
    ar: "روابط fb.watch لا يمكن استخدامها — افتح الرابط في المتصفح وانسخ الرابط الكامل من شريط العنوان.",
  },
  multiple: {
    en: "More than one post was found in what you pasted. Paste a single link instead.",
    fr: "Plusieurs publications ont été détectées dans le contenu collé. Collez un seul lien à la place.",
    ar: "تم العثور على أكثر من منشور واحد فيما تم لصقه. الصق رابط منشور واحد فقط.",
  },
};

/** Convenience accessor for the common case: a journalist-facing Arabic string. */
export function embedFailureMessageAr(reason: EmbedFailure): string {
  return EMBED_FAILURE_MESSAGES[reason].ar;
}
