import { RichText } from "@payloadcms/richtext-lexical/react";
import { AdSlot } from "@/components/ads/AdSlot";

type Props = {
  content: any;
};

export function InArticleAdInjector({ content }: Props) {
  if (!content?.root?.children) return null;

  const children = content.root.children as any[];
  const firstParagraphIndex = children.findIndex((node) => node.type === "paragraph");

  // No paragraph, or first paragraph is the last node → no split, no ad.
  if (firstParagraphIndex === -1 || firstParagraphIndex >= children.length - 1) {
    return <RichText data={content} />;
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
      <div className="prose prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground leading-arabic">
        <RichText data={before} />
      </div>
      <AdSlot slotName="inArticleMid" format="in-article" loading="lazy" className="my-6" />
      <div className="prose prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground leading-arabic">
        <RichText data={after} />
      </div>
    </>
  );
}
