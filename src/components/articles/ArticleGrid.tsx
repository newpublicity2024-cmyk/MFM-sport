import { Fragment } from "react";
import { ArticleCard } from "./ArticleCard";
import { AdSlot } from "@/components/ads/AdSlot";
import { AdCarousel } from "@/components/ads/AdCarousel";
import type { AdItem } from "@/lib/payload/ads";

type Props = {
  articles: any[];
  locale: string;
  columns?: 2 | 3 | 4;
  withAds?: boolean;
  adCards?: AdItem[];
};

const AD_EVERY = 8; // AdSense full-width strip cadence (unchanged)
const AD_CARD_EVERY = 6; // managed blog-sized ad-card cadence

export function ArticleGrid({
  articles,
  locale,
  columns = 3,
  withAds = false,
  adCards = [],
}: Props) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  const hasAdCards = adCards.length > 0;

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {articles.map((article, index) => {
        const insertAdAfter =
          withAds && (index + 1) % AD_EVERY === 0 && index !== articles.length - 1;
        const insertAdCardAfter =
          hasAdCards &&
          (index + 1) % AD_CARD_EVERY === 0 &&
          index !== articles.length - 1;
        return (
          <Fragment key={article.id}>
            <ArticleCard article={article} locale={locale} />
            {insertAdCardAfter && (
              <AdCarousel ads={adCards} format="card" />
            )}
            {insertAdAfter && (
              <div className="col-span-full">
                <AdSlot slotName="inGrid" format="in-grid" loading="lazy" />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
