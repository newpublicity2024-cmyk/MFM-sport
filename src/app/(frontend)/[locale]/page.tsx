import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getArticles } from "@/lib/payload/queries";
import { getFixturesByDate } from "@/lib/api-football/fixtures";
import { HeroSection } from "@/components/home/HeroSection";
import { NewsSection } from "@/components/home/NewsSection";
import { MatchList } from "@/components/football/MatchList";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NewsletterStrip } from "@/components/newsletter/NewsletterStrip";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "ar"
      ? "MFM Sport - أخبار الكرة المغربية"
      : locale === "fr"
        ? "MFM Sport - Actualites du football marocain"
        : "MFM Sport - Moroccan Football News",
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });
  const tArticle = await getTranslations({ locale, namespace: "article" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const today = new Date().toISOString().split("T")[0];
  const todayFixtures = await getFixturesByDate(today);

  // Fetch latest articles for the homepage
  const latest = await getArticles({ locale, page: 1, limit: 16 });
  const articles = latest.docs;

  // Split articles: 1 hero + 3 secondary + rest
  const featured = articles[0];
  const secondary = articles.slice(1, 4);
  const topNews = articles.slice(4, 10);
  const moreNews = articles.slice(10, 16);

  if (!featured) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-primary mb-4">MFM Sport</h1>
        <p className="text-muted-foreground">{tArticle("noArticles")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <HeroSection featured={featured} secondary={secondary} locale={locale} />

      {todayFixtures.length > 0 && (
        <section className="mt-10">
          <SectionHeader
            title={t("todayMatches")}
            href={`/${locale}/matches`}
            linkText={tCommon("readMore")}
          />
          <MatchList fixtures={todayFixtures.slice(0, 10)} locale={locale} />
        </section>
      )}

      <NewsSection
        title={t("topNews")}
        articles={topNews}
        locale={locale}
        viewAllHref={`/${locale}/articles`}
        viewAllText={tCommon("readMore")}
        columns={3}
      />

      <NewsSection
        title={t("latestNews")}
        articles={moreNews}
        locale={locale}
        viewAllHref={`/${locale}/articles`}
        viewAllText={tCommon("readMore")}
        columns={3}
      />

      <div className="mt-10">
        <NewsletterStrip locale={locale} />
      </div>
    </div>
  );
}
