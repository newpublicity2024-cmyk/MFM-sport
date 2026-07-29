import type { JSXConvertersFunction } from "@payloadcms/richtext-lexical/react";
import type { DefaultNodeTypes, SerializedBlockNode } from "@payloadcms/richtext-lexical";
import type {
  AudioBlock as AudioBlockFields,
  EmbedFrameBlock as EmbedFrameBlockFields,
  GalleryBlock as GalleryBlockFields,
  SocialEmbedBlock as SocialEmbedBlockFields,
} from "@/payload-types";
import { articleImageConverter } from "./blocks/imageConverter";
import { SocialEmbedRenderer } from "./blocks/SocialEmbedRenderer";
import { Gallery } from "./blocks/Gallery";
import { Audio } from "./blocks/Audio";
import { EmbedFrame } from "./blocks/EmbedFrame";

type ArticleBlockFields = SocialEmbedBlockFields | GalleryBlockFields | AudioBlockFields | EmbedFrameBlockFields;

export type ArticleNodeTypes = DefaultNodeTypes | SerializedBlockNode<ArticleBlockFields>;

/**
 * The ONE shared converter module. Every `<RichText>` call site in the app
 * imports this -- blocks render as nothing at any site that doesn't (see
 * ArticleBody.tsx and InArticleAdInjector.tsx). Overrides the default image
 * (upload node) converter and registers a renderer for each of the four
 * journalist-authoring blocks (Task 4): socialEmbed, gallery, audio, embedFrame.
 */
export const articleJSXConverters: JSXConvertersFunction<ArticleNodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  upload: articleImageConverter,
  blocks: {
    // Every block converter guards `node.fields` before reading from it, and
    // renders nothing rather than throwing. `SerializedBlockNode.fields` is
    // typed as always-present by @payloadcms/richtext-lexical, but that type
    // does not survive the trip through stored jsonb -- a `{ type: "block" }`
    // node with no `fields` key, or `fields: null`, is real, reachable data
    // (a hand-edited row, a future schema change, a bulk migration), and
    // `node.fields.source` on either throws a TypeError. In a Server Component
    // that is an HTTP 500 on an article page, which is exactly what the staged
    // indexation release depends on not happening. See task-567-report.md,
    // fix round 1, Finding 1.
    socialEmbed: ({ node }) => {
      if (!node.fields) return null;
      return <SocialEmbedRenderer source={node.fields.source} caption={node.fields.caption} />;
    },
    gallery: ({ node }) => {
      if (!node.fields) return null;
      return <Gallery images={node.fields.images} layout={node.fields.layout} />;
    },
    audio: ({ node }) => {
      if (!node.fields) return null;
      return <Audio file={node.fields.file} title={node.fields.title} />;
    },
    embedFrame: ({ node }) => {
      if (!node.fields) return null;
      return <EmbedFrame src={node.fields.src} height={node.fields.height} title={node.fields.title} />;
    },
  },
});
