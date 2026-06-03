import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations("notFound");

  return (
    <div className="container py-20 max-w-2xl text-center">
      <p className="text-sm uppercase tracking-wider text-muted-foreground mb-4">404</p>
      <h1 className="text-[clamp(1.875rem,4vw+1rem,2.5rem)] font-bold mb-4">{t("title")}</h1>
      <p className="text-muted-foreground mb-8">{t("description")}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
        >
          {t("backToHome")}
        </Link>
        <Link
          href={`/${locale}/articles`}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-md border border-border bg-card hover:border-primary/30 transition-colors font-medium"
        >
          {t("browseArticles")}
        </Link>
      </div>
    </div>
  );
}
