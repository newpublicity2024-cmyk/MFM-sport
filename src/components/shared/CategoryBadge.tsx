import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Props = {
  name: string;
  slug: string;
  locale: string;
};

export function CategoryBadge({ name, slug, locale }: Props) {
  return (
    <Link href={`/${locale}/category/${slug}`}>
      <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium">
        {name}
      </Badge>
    </Link>
  );
}
