"use client";

import { useTranslations } from "next-intl";
import type { ApiFixture } from "@/lib/api-football/types";
import { useLiveFixtures } from "@/hooks/useLiveFixtures";
import { MatchList } from "@/components/football/MatchList";
import { SectionHeader } from "@/components/shared/SectionHeader";

type Props = {
  initial: ApiFixture[];
  locale: string;
};

export function LiveNowSection({ initial, locale }: Props) {
  const t = useTranslations("match");
  const tCommon = useTranslations("common");
  const { fixtures } = useLiveFixtures({
    initial,
    intervalMs: 60000,
    enabled: true,
  });

  if (fixtures.length === 0) return null;

  return (
    <section className="mt-10">
      <SectionHeader
        title={t("liveNow")}
        href={`/${locale}/matches`}
        linkText={tCommon("readMore")}
      />
      <div className="flex items-center gap-2 mb-2 text-xs text-live">
        <span className="inline-block h-2 w-2 rounded-full bg-live animate-pulse" />
        {t("live")}
      </div>
      <MatchList fixtures={fixtures.slice(0, 10)} locale={locale} />
    </section>
  );
}
