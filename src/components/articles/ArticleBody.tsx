import { RichText } from "@payloadcms/richtext-lexical/react";

type Props = {
  content: any;
};

export function ArticleBody({ content }: Props) {
  if (!content) return null;

  return (
    <div className="prose prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:text-muted-foreground leading-arabic">
      <RichText data={content} />
    </div>
  );
}
