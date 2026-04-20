"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

type Props = {
  locale: string;
  className?: string;
  onLinkClick?: () => void;
};

const navItems = [
  { key: "home", href: "" },
  { key: "news", href: "/articles" },
  { key: "competitions", href: "/competition" },
  { key: "matches", href: "/matches" },
  { key: "videos", href: "/videos" },
] as const;

export function Nav({ locale, className, onLinkClick }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className={className}>
      {navItems.map((item) => {
        const href = `/${locale}${item.href}`;
        const isActive =
          item.href === ""
            ? pathname === `/${locale}` || pathname === `/${locale}/`
            : pathname.startsWith(href);

        return (
          <Link
            key={item.key}
            href={href}
            onClick={onLinkClick}
            className={`text-sm font-medium transition-colors hover:text-primary ${
              isActive ? "text-primary" : "text-foreground/80"
            }`}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
