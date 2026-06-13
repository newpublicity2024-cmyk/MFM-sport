import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getFixtureById } from "@/lib/api-football/fixtures";
import { LiveScoreboard } from "@/components/football/LiveScoreboard";
import { MatchEvents } from "@/components/football/MatchEvents";
import { MatchLineup } from "@/components/football/MatchLineup";
import { MatchStats } from "@/components/football/MatchStats";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { localizeLeague, localizeRound, localizeTeam } from "@/lib/api-football/localize";

// ISR: regenerate the match shell at most once a minute; live score/events
// still stream client-side via LiveScoreboard polling the cached fixture API.
export const revalidate = 60;

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const fixture = await getFixtureById(Number(id));
  if (!fixture) return { title: "Not Found" };
  const home = localizeTeam(fixture.teams.home.id, fixture.teams.home.name, locale);
  const away = localizeTeam(fixture.teams.away.id, fixture.teams.away.name, locale);
  return {
    title: `${home} vs ${away} | MFM Sport`,
  };
}

export default async function MatchPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const fixture = await getFixtureById(Number(id));
  if (!fixture) notFound();

  const t = await getTranslations({ locale, namespace: "match" });
  const { home, away } = fixture.teams;

  return (
    <div className="container py-8 max-w-4xl">
      {/* League info */}
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <Image src={fixture.league.logo} alt={fixture.league.name} width={20} height={20} />
        <span>{localizeLeague(fixture.league.id, fixture.league.name, locale)}</span>
        <span>·</span>
        <span>{localizeRound(fixture.league.round, locale)}</span>
      </div>

      {/* Score header */}
      <LiveScoreboard initial={fixture} locale={locale} />

      {/* Events */}
      {fixture.events && fixture.events.length > 0 && (
        <section className="mb-8">
          <SectionHeader title={t("events")} />
          <div className="bg-card rounded-lg border border-border p-4">
            <MatchEvents events={fixture.events} homeTeamId={home.id} locale={locale} />
          </div>
        </section>
      )}

      {/* Statistics */}
      {fixture.statistics && fixture.statistics.length >= 2 && (
        <section className="mb-8">
          <SectionHeader title={t("statistics")} />
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex justify-between text-sm font-medium mb-4">
              <div className="flex items-center gap-2">
                <Image src={home.logo} alt={home.name} width={16} height={16} />
                <span>{localizeTeam(home.id, home.name, locale)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{localizeTeam(away.id, away.name, locale)}</span>
                <Image src={away.logo} alt={away.name} width={16} height={16} />
              </div>
            </div>
            <MatchStats statistics={fixture.statistics} />
          </div>
        </section>
      )}

      {/* Lineups */}
      {fixture.lineups && fixture.lineups.length >= 2 && (
        <section className="mb-8">
          <SectionHeader title={t("lineup")} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fixture.lineups.map((lineup) => (
              <div key={lineup.team.id} className="bg-card rounded-lg border border-border p-4">
                <MatchLineup
                  lineup={lineup}
                  locale={locale}
                  labels={{
                    startingXI: t("startingXI"),
                    substitutes: t("substitutes"),
                    coach: t("coach"),
                    formation: t("formation"),
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
