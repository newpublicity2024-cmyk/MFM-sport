import Link from "next/link";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";

type Props = {
  locale: string;
};

const socialLinks = [
  { name: "Facebook", href: "https://facebook.com/mfmsport", Icon: Facebook },
  { name: "Instagram", href: "https://instagram.com/mfmsport", Icon: Instagram },
  { name: "X", href: "https://x.com/mfmsport", Icon: Twitter },
  { name: "YouTube", href: "https://youtube.com/mfmsport", Icon: Youtube },
];

export function Footer({ locale }: Props) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link href={`/${locale}`} className="inline-block">
              <span className="text-xl font-bold text-primary">MFM</span>
              <span className="text-xl font-bold text-foreground"> Sport</span>
            </Link>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href={`/${locale}/about`} className="hover:text-foreground transition-colors">
              {locale === "ar" ? "من نحن" : locale === "fr" ? "A propos" : "About"}
            </Link>
            <Link href={`/${locale}/contact`} className="hover:text-foreground transition-colors">
              {locale === "ar" ? "اتصل بنا" : locale === "fr" ? "Contact" : "Contact"}
            </Link>
            <Link href={`/${locale}/legal`} className="hover:text-foreground transition-colors">
              {locale === "ar" ? "إشعار قانوني" : locale === "fr" ? "Mentions legales" : "Legal"}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-foreground transition-colors">
              {locale === "ar" ? "الخصوصية" : locale === "fr" ? "Confidentialite" : "Privacy"}
            </Link>
          </div>

          {/* Social */}
          <div className="flex gap-3">
            {socialLinks.map(({ name, href, Icon }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors"
                aria-label={name}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </a>
            ))}
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-sm font-medium mb-2">
              {locale === "ar" ? "النشرة الإخبارية" : locale === "fr" ? "Newsletter" : "Newsletter"}
            </h3>
            <NewsletterForm locale={locale} />
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          &copy; {currentYear} MFM Sport.{" "}
          {locale === "ar"
            ? "جميع الحقوق محفوظة"
            : locale === "fr"
              ? "Tous droits reserves"
              : "All rights reserved"}
          .
        </div>
      </div>
    </footer>
  );
}
