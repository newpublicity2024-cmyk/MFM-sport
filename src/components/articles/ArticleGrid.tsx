import { Fragment } from "react";
import { ArticleCard } from "./ArticleCard";
import { AdSlot } from "@/components/ads/AdSlot";

type Props = {
  articles: any[];
  locale: string;
  columns?: 2 | 3 | 4;
  withAds?: boolean;
};

const AD_EVERY = 8;

export function ArticleGrid({ articles, locale, columns = 3, withAds = false }: Props) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {articles.map((article, index) => {
        const insertAdAfter =
          withAds && (index + 1) % AD_EVERY === 0 && index !== articles.length - 1;
        return (
          <Fragment key={article.id}>
            <ArticleCard article={article} locale={locale} />
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
