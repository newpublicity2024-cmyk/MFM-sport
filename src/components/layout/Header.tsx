import Link from "next/link";
import { Nav } from "./Nav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";

type Props = {
  locale: string;
};

export function Header({ locale }: Props) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">MFM</span>
          <span className="text-xl font-bold text-foreground">Sport</span>
        </Link>

        {/* Desktop nav */}
        <Nav locale={locale} className="hidden md:flex items-center gap-6" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          <MobileNav locale={locale} />
        </div>
      </div>
    </header>
  );
}
