import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import Link from "next/link";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getCompetitions } from "@/lib/payload/queries";
import { getEntityLogoUrl } from "@/lib/utils";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: `${t("competitions")} | MFM Sport` };
}

export default async function CompetitionsIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "nav" });
  const tComp = await getTranslations({ locale, namespace: "competition" });
  const result = await getCompetitions(locale as Config["locale"]);

  const leagues = result.docs.filter((c: any) => c.type === "league");
  const cups = result.docs.filter((c: any) => c.type === "cup");

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">{t("competitions")}</h1>

      {leagues.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">{tComp("standings")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {leagues.map((c: any) => (
              <CompetitionCard key={c.id} competition={c} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {cups.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">{tComp("fixtures")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {cups.map((c: any) => (
              <CompetitionCard key={c.id} competition={c} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CompetitionCard({ competition, locale }: { competition: any; locale: string }) {
  const logoUrl = getEntityLogoUrl(competition);
  return (
    <Link
      href={`/${locale}/competition/${competition.slug}`}
      className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
    >
      {logoUrl ? (
        <Image src={logoUrl} alt={competition.name} width={48} height={48} className="object-contain h-12 w-12" />
      ) : (
        <div className="h-12 w-12 rounded bg-muted" aria-hidden />
      )}
      <span className="text-sm font-medium text-center">{competition.name}</span>
      {competition.country && (
        <span className="text-xs text-muted-foreground">{competition.country}</span>
      )}
    </Link>
  );
}
