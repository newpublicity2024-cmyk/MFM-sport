import { Tweet } from "react-tweet";
import "react-tweet/theme.css";

type Props = {
  id: string;
  canonicalUrl: string;
  caption?: string | null;
};

/**
 * Arabic-first override of react-tweet's built-in "not found" state (default
 * text is English: "Tweet not found"). This site serves only Arabic to readers
 * (CLAUDE.md → Conventions). Unlike Facebook/Instagram, X's syndication API DOES
 * reliably signal a deleted/private/suspended tweet server-side (getTweet
 * returns undefined rather than a blank-but-200 response), so this is a real,
 * detected error state -- not the unconditional A1 fallback those two need.
 */
function ArabicTweetNotFound({ canonicalUrl }: { canonicalUrl: string }) {
  return (
    <p className="my-6 text-sm text-muted-foreground" dir="rtl">
      تعذّر عرض هذا المنشور — قد يكون محذوفًا أو من حساب خاص.{" "}
      <a href={canonicalUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
        شاهد على إكس
      </a>
    </p>
  );
}

export function XEmbed({ id, canonicalUrl, caption }: Props) {
  if (!id) return null;

  return (
    <div className="my-6">
      {/* Tweets are LTR content inside an RTL page and lay out wrong otherwise --
          this is the difference between a readable and an unreadable tweet. */}
      <div dir="ltr">
        <Tweet
          id={id}
          // Cache the syndication fetch: react-tweet's own fetchTweet() sets no
          // caching option itself, so without this every render re-hits
          // cdn.syndication.twimg.com.
          fetchOptions={{ next: { revalidate: 3600 } }}
          components={{ TweetNotFound: () => <ArabicTweetNotFound canonicalUrl={canonicalUrl} /> }}
        />
      </div>
      {caption && (
        <p className="mt-2 text-sm text-muted-foreground" dir="rtl">
          {caption}
        </p>
      )}
    </div>
  );
}
