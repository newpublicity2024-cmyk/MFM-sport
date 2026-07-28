import type { Metadata } from "next";
import type { Config } from "@/payload-types";
import Link from "next/link";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getClubs } from "@/lib/payload/queries";
import { getEntityLogoUrl } from "@/lib/utils";

// Clubs change rarely — serve from edge cache, revalidate hourly.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: `${t("clubs")} | MFM Sport`, alternates: { canonical: `/${locale}/club` }, };
}

export default async function ClubsIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "nav" });
  const result = await getClubs(locale as Config["locale"]);

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-8">{t("clubs")}</h1>

      {result.docs.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {result.docs.map((club: any) => {
            const logoUrl = getEntityLogoUrl(club);
            return (
              <Link
                key={club.id}
                href={`/${locale}/club/${club.slug}`}
                className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
              >
                {logoUrl ? (
                  <Image src={logoUrl} alt={club.name} width={48} height={48} className="object-contain h-12 w-12" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted" aria-hidden />
                )}
                <span className="text-sm font-medium text-center">{club.name}</span>
                {club.country && (
                  <span className="text-xs text-muted-foreground">{club.country}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
