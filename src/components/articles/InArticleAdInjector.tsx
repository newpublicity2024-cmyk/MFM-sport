import { RichText } from "@payloadcms/richtext-lexical/react";
import { AdSlot } from "@/components/ads/AdSlot";
import { articleJSXConverters } from "./richTextConverters";

type LexicalNodeLike = { type: string; [key: string]: unknown };
type LexicalContentLike = {
  root: { children: LexicalNodeLike[]; [key: string]: unknown };
  [key: string]: unknown;
};

type Props = {
  content: LexicalContentLike | null | undefined;
};

export function InArticleAdInjector({ content }: Props) {
  if (!content?.root?.children) return null;

  const children = content.root.children;
  const firstParagraphIndex = children.findIndex((node) => node.type === "paragraph");

  if (firstParagraphIndex === -1 || firstParagraphIndex >= children.length - 1) {
    return <RichText data={content as never} converters={articleJSXConverters} />;
  }

  const before = {
    ...content,
    root: { ...content.root, children: children.slice(0, firstParagraphIndex + 1) },
  };
  const after = {
    ...content,
    root: { ...content.root, children: children.slice(firstParagraphIndex + 1) },
  };

  return (
    <>
      <div className="prose dark:prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground leading-arabic">
        <RichText data={before as never} converters={articleJSXConverters} />
      </div>
      <AdSlot slotName="inArticleMid" format="in-article" loading="lazy" className="my-6" />
      <div className="prose dark:prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground leading-arabic">
        <RichText data={after as never} converters={articleJSXConverters} />
      </div>
    </>
  );
}
