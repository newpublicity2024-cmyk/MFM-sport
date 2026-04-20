import Image from "next/image";
import { getImageUrl } from "@/lib/utils";

type Props = {
  author: {
    name: string;
    bio?: string | null;
    avatar?: any;
    social?: {
      twitter?: string | null;
      facebook?: string | null;
      instagram?: string | null;
    };
  };
  locale: string;
};

export function AuthorCard({ author, locale }: Props) {
  const avatarUrl = getImageUrl(author.avatar, "thumbnail");

  return (
    <div className="flex flex-col sm:flex-row items-start gap-4 p-6 rounded-lg bg-card border border-border">
      {avatarUrl && (
        <Image
          src={avatarUrl}
          alt={author.name}
          width={80}
          height={80}
          className="rounded-full"
        />
      )}
      <div className="flex-1">
        <h2 className="text-xl font-bold">{author.name}</h2>
        {author.bio && (
          <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
            {author.bio}
          </p>
        )}
        {author.social && (
          <div className="mt-3 flex gap-3">
            {author.social.twitter && (
              <a href={author.social.twitter} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                X / Twitter
              </a>
            )}
            {author.social.facebook && (
              <a href={author.social.facebook} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Facebook
              </a>
            )}
            {author.social.instagram && (
              <a href={author.social.instagram} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Instagram
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
