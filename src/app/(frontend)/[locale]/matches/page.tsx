import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getFixturesByDate } from "@/lib/api-football/fixtures";
import { MatchList } from "@/components/football/MatchList";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
};

function formatApiDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "match" });
  return { title: `${t("today")} | MFM Sport` };
}

export default async function MatchesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { date } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "match" });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const selectedDate = date || formatApiDate(today);

  const [todayFixtures, yesterdayFixtures, tomorrowFixtures] = await Promise.all([
    getFixturesByDate(formatApiDate(today)),
    getFixturesByDate(formatApiDate(yesterday)),
    getFixturesByDate(formatApiDate(tomorrow)),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("today")}</h1>

      {/* Date navigation */}
      <div className="flex gap-2 mb-8">
        {[
          { label: formatApiDate(yesterday), fixtures: yesterdayFixtures },
          { label: formatApiDate(today), fixtures: todayFixtures },
          { label: formatApiDate(tomorrow), fixtures: tomorrowFixtures },
        ].map(({ label }) => (
          <a
            key={label}
            href={`/${locale}/matches?date=${label}`}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              label === selectedDate
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Today's matches */}
      <section className="mb-10">
        <SectionHeader title={t("today")} />
        {todayFixtures.length > 0 ? (
          <MatchList fixtures={todayFixtures} locale={locale} />
        ) : (
          <p className="text-muted-foreground text-center py-8">{t("noMatches")}</p>
        )}
      </section>

      {/* Recent results */}
      {yesterdayFixtures.length > 0 && (
        <section className="mb-10">
          <SectionHeader title={t("recent")} />
          <MatchList fixtures={yesterdayFixtures} locale={locale} />
        </section>
      )}

      {/* Upcoming */}
      {tomorrowFixtures.length > 0 && (
        <section>
          <SectionHeader title={t("upcoming")} />
          <MatchList fixtures={tomorrowFixtures} locale={locale} />
        </section>
      )}
    </div>
  );
}
