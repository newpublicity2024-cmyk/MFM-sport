import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getFixturesByDate } from "@/lib/api-football/fixtures";
import { getCompetitions } from "@/lib/payload/queries";
import { MatchList } from "@/components/football/MatchList";
import { DateStrip } from "@/components/football/DateStrip";
import { CompetitionFilter } from "@/components/football/CompetitionFilter";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; league?: string }>;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(s: string | undefined): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidLeague(s: string | undefined): s is string {
  return typeof s === "string" && /^\d+$/.test(s);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "match" });
  return { title: `${t("today")} | MFM Sport` };
}

export default async function MatchesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { date: rawDate, league: rawLeague } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "match" });
  const tComp = await getTranslations({ locale, namespace: "competition" });

  const selectedDate = isValidDate(rawDate) ? rawDate : todayISO();
  const selectedLeague = isValidLeague(rawLeague) ? rawLeague : null;

  const [allFixtures, competitionsResult] = await Promise.all([
    getFixturesByDate(selectedDate),
    getCompetitions(locale as Config["locale"]),
  ]);

  const fixtures = selectedLeague
    ? allFixtures.filter((f) => String(f.league.id) === selectedLeague)
    : allFixtures;

  const basePath = `/${locale}/matches`;

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">{t("today")}</h1>

      <DateStrip
        selected={selectedDate}
        locale={locale}
        basePath={basePath}
        league={selectedLeague ?? undefined}
      />

      <CompetitionFilter
        competitions={competitionsResult.docs.map((c: any) => ({
          id: c.id,
          name: c.name,
          apiFootballId: c.apiFootballId,
        }))}
        selectedLeague={selectedLeague}
        date={selectedDate}
        basePath={basePath}
        allLabel={tComp("allCompetitions")}
        locale={locale}
      />

      {fixtures.length > 0 ? (
        <MatchList fixtures={fixtures} locale={locale} />
      ) : (
        <p className="text-muted-foreground text-center py-8">{t("noMatches")}</p>
      )}
    </div>
  );
}
