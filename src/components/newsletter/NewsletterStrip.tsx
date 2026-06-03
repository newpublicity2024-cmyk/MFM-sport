import { useTranslations } from "next-intl";
import { NewsletterForm } from "./NewsletterForm";

type Props = {
  locale: string;
};

export function NewsletterStrip({ locale }: Props) {
  const t = useTranslations("newsletter");

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 px-4 py-10 text-center shadow-sm">
      <h2 className="text-xl font-bold mb-2">{t("title")}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t("subtitle")}</p>
      <NewsletterForm locale={locale} />
    </section>
  );
}
