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
    socialEmbed: ({ node }) => (
      <SocialEmbedRenderer source={node.fields.source} caption={node.fields.caption} />
    ),
    gallery: ({ node }) => <Gallery images={node.fields.images} layout={node.fields.layout} />,
    audio: ({ node }) => <Audio file={node.fields.file} title={node.fields.title} />,
    embedFrame: ({ node }) => (
      <EmbedFrame src={node.fields.src} height={node.fields.height} title={node.fields.title} />
    ),
  },
});
