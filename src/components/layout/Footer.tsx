import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { BrandLogo } from "./BrandLogo";
import { FOOTER_SOCIALS } from "@/components/social/socialLinks";

type Props = {
  locale: string;
};

export async function Footer({ locale }: Props) {
  const currentYear = new Date().getFullYear();
  const t = await getTranslations({ locale, namespace: "footer" });
  const tNewsletter = await getTranslations({ locale, namespace: "newsletter" });

  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link
              href={`/${locale}`}
              className="inline-block"
              aria-label="MFM Sport"
            >
              <BrandLogo size="lg" />
            </Link>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href={`/${locale}/about`} className="hover:text-foreground transition-colors">
              {t("about")}
            </Link>
            <Link href={`/${locale}/contact`} className="hover:text-foreground transition-colors">
              {t("contact")}
            </Link>
            <Link href={`/${locale}/legal`} className="hover:text-foreground transition-colors">
              {t("legal")}
            </Link>
            <Link href={`/${locale}/privacy`} className="hover:text-foreground transition-colors">
              {t("privacy")}
            </Link>
          </div>

          {/* Social */}
          <div className="flex gap-3">
            {FOOTER_SOCIALS.map(({ name, href, Icon }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-11 h-11 rounded-md bg-secondary text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors"
                aria-label={name}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </a>
            ))}
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-sm font-medium mb-2">{tNewsletter("label")}</h3>
            <NewsletterForm locale={locale} />
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground">
          &copy; {currentYear} MFM Sport. {t("rights")}.
        </div>
      </div>
    </footer>
  );
}
