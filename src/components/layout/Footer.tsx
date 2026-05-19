import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { BrandLogo } from "./BrandLogo";

type Props = {
  locale: string;
};

type SocialIconProps = { className?: string };

function FacebookIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
    </svg>
  );
}

function InstagramIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.908 4.908 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 0 1-1.153 1.772 4.915 4.915 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.904 4.904 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 0 1 1.153-1.772A4.897 4.897 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm6.5-.25a1.25 1.25 0 0 0-2.5 0 1.25 1.25 0 0 0 2.5 0zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    </svg>
  );
}

function XIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function YoutubeIcon({ className }: SocialIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

const socialLinks = [
  { name: "Facebook", href: "https://facebook.com/mfmsport", Icon: FacebookIcon },
  { name: "Instagram", href: "https://instagram.com/mfmsport", Icon: InstagramIcon },
  { name: "X", href: "https://x.com/mfmsport", Icon: XIcon },
  { name: "YouTube", href: "https://youtube.com/mfmsport", Icon: YoutubeIcon },
];

export async function Footer({ locale }: Props) {
  const currentYear = new Date().getFullYear();
  const t = await getTranslations({ locale, namespace: "footer" });
  const tNewsletter = await getTranslations({ locale, namespace: "newsletter" });

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-8">
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
            {socialLinks.map(({ name, href, Icon }) => (
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
