import type { Block } from "payload";
import { parseEmbed } from "@/lib/embeds/parseEmbed";
import { EMBED_FAILURE_MESSAGES } from "@/lib/embeds/messages";

/**
 * Reduces whatever a journalist pasted (a bare link or a full embed snippet) to the
 * canonical URL `parseEmbed` resolves it to. Never returns anything HTML-shaped: on
 * success the canonical URL replaces the raw value outright; on failure the raw value
 * passes through unchanged so `validateSocialEmbedSource` can still report *why*.
 *
 * This is the pure logic behind the `source` field's `beforeChange` hook — exported and
 * unit-tested on its own, separately from the empirical question of whether Payload
 * actually invokes a field-level `beforeChange` hook for a field nested inside a Lexical
 * block in this installed version (see Task 4's report for that experiment's result).
 */
export function normalizeSocialEmbedSource(value: unknown): unknown {
  const result = parseEmbed(value);
  return result.ok ? result.embed.canonicalUrl : value;
}

/**
 * `validate()` for the `source` field: the guarantee that holds regardless of which
 * normalisation mechanism is wired up. Runs the same parser and, on failure, returns the
 * Arabic message for the reason — from `messages.ts`, not authored here, so Task 5's
 * renderer fallback can reuse the identical wording.
 */
export function validateSocialEmbedSource(value: unknown): true | string {
  const result = parseEmbed(value);
  if (result.ok) return true;
  return EMBED_FAILURE_MESSAGES[result.reason].ar;
}

export const SocialEmbedBlock: Block = {
  slug: "socialEmbed",
  interfaceName: "SocialEmbedBlock",
  labels: {
    singular: { en: "Social embed", fr: "Publication intégrée", ar: "تضمين منشور" },
    plural: { en: "Social embeds", fr: "Publications intégrées", ar: "تضمينات منشورات" },
  },
  fields: [
    {
      name: "source",
      type: "text",
      required: true,
      label: { en: "Post link", fr: "Lien de la publication", ar: "رابط المنشور" },
      admin: {
        description: {
          en: "Paste the post's link, or the embed code copied from Facebook, X, Instagram or YouTube — either works. It is cleaned up to a plain link automatically when you save.",
          fr: "Collez le lien de la publication, ou le code d'intégration copié depuis Facebook, X, Instagram ou YouTube — les deux fonctionnent.",
          ar: "الصق رابط المنشور، أو كود التضمين المنسوخ من فيسبوك أو إكس أو إنستغرام أو يوتيوب — كلاهما يعمل. يتحوّل تلقائيًا إلى رابط نظيف عند الحفظ.",
        },
      },
      // See §1 of the Task 4 brief / report: whether this hook actually fires for a
      // field nested inside a Lexical block was an open, empirically-settled question
      // for this Payload version, not an assumption.
      hooks: {
        beforeChange: [({ value }) => normalizeSocialEmbedSource(value)],
      },
      validate: (value: unknown) => validateSocialEmbedSource(value),
    },
    {
      name: "caption",
      type: "text",
      label: { en: "Caption", fr: "Légende", ar: "التعليق" },
      admin: {
        description: {
          en: "Shown beneath the embed to every reader — this is not an internal note. A deleted post, a private account, or a suspended one all still return a normal page and render nothing, and that can't be detected from the server, so this caption (plus a link to the original post) is what a reader sees when the embed itself doesn't load.",
          fr: "Affichée sous le contenu intégré, visible par tous les lecteurs — ce n'est pas une note interne.",
          ar: "تظهر تحت التضمين لكل قارئ — وهي ليست ملاحظة داخلية. المنشور المحذوف أو الحساب الخاص أو الموقوف كلها تُرجع صفحة عادية دون أن تعرض شيئًا، ولا يمكن اكتشاف ذلك من الخادم، لذلك يكون هذا التعليق (مع رابط المنشور الأصلي) ما يراه القارئ إن لم يظهر التضمين نفسه.",
        },
      },
    },
  ],
};
