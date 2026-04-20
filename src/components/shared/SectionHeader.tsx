import Link from "next/link";

type Props = {
  title: string;
  href?: string;
  linkText?: string;
};

export function SectionHeader({ title, href, linkText }: Props) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold relative">
        {title}
        <span className="absolute -bottom-1 start-0 w-12 h-0.5 bg-primary" />
      </h2>
      {href && linkText && (
        <Link
          href={href}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          {linkText} &rarr;
        </Link>
      )}
    </div>
  );
}
