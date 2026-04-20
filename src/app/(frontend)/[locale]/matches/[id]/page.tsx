import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getFixtureById } from "@/lib/api-football/fixtures";
import { getMatchStatus } from "@/lib/api-football/types";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { MatchEvents } from "@/components/football/MatchEvents";
import { MatchLineup } from "@/components/football/MatchLineup";
import { MatchStats } from "@/components/football/MatchStats";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const fixture = await getFixtureById(Number(id));
  if (!fixture) return { title: "Not Found" };
  return {
    title: `${fixture.teams.home.name} vs ${fixture.teams.away.name} | MFM Sport`,
  };
}

export default async function MatchPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const fixture = await getFixtureById(Number(id));
  if (!fixture) notFound();

  const t = await getTranslations({ locale, namespace: "match" });
  const status = getMatchStatus(fixture.fixture.status.short);
  const { home, away } = fixture.teams;
  const goals = fixture.goals;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* League info */}
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <Image src={fixture.league.logo} alt={fixture.league.name} width={20} height={20} />
        <span>{fixture.league.name}</span>
        <span>·</span>
        <span>{fixture.league.round}</span>
      </div>

      {/* Score header */}
      <div className="bg-card rounded-lg border border-border p-6 mb-8">
        <div className="flex items-center justify-between">
          {/* Home */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <Image src={home.logo} alt={home.name} width={56} height={56} />
            <span className={cn("text-sm font-medium text-center", home.winner && "font-bold")}>
              {home.name}
            </span>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center mx-4">
            {status === "scheduled" ? (
              <>
                <span className="text-2xl font-bold text-muted-foreground">vs</span>
                <span className="text-sm text-muted-foreground mt-1">
                  {formatTime(fixture.fixture.date, locale)}
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-4xl font-bold tabular-nums">
                  <span>{goals.home ?? 0}</span>
                  <span className="text-muted-foreground text-2xl">-</span>
                  <span>{goals.away ?? 0}</span>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium mt-1 px-2 py-0.5 rounded",
                    status === "live" && "bg-live/20 text-live",
                    status === "finished" && "bg-secondary text-muted-foreground",
                  )}
                >
                  {status === "live"
                    ? `${t("live")} ${fixture.fixture.status.elapsed || ""}'`
                    : t("fullTime")}
                </span>
              </>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-2 flex-1">
            <Image src={away.logo} alt={away.name} width={56} height={56} />
            <span className={cn("text-sm font-medium text-center", away.winner && "font-bold")}>
              {away.name}
            </span>
          </div>
        </div>

        {/* Match info */}
        <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <span>{formatDate(fixture.fixture.date, locale)}</span>
          {fixture.fixture.venue?.name && <span>{fixture.fixture.venue.name}</span>}
          {fixture.fixture.referee && <span>{fixture.fixture.referee}</span>}
        </div>
      </div>

      {/* Events */}
      {fixture.events && fixture.events.length > 0 && (
        <section className="mb-8">
          <SectionHeader title={t("events")} />
          <div className="bg-card rounded-lg border border-border p-4">
            <MatchEvents events={fixture.events} homeTeamId={home.id} />
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
                <span>{home.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{away.name}</span>
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
