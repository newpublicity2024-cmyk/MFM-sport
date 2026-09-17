import { NextResponse } from "next/server";
import type { Config } from "@/payload-types";
import { getArticlesByTag } from "@/lib/payload/queries";
import { toLeagueCard, type LeagueCardArticle } from "@/lib/home/cards";

/**
 * A tag's newest articles for the homepage "latest news" chips.
 *
 * The chip row lists the site's most-used tags; prefetching a dozen cards for
 * each of them would put the whole archive's front page into the homepage
 * HTML, so a chip's list is fetched here when it is first selected. Cached
 * at the edge like the page itself (five minutes).
 */
export const revalidate = 300;

export const HOME_LATEST_NEWS_LIMIT = 12;

const LOCALES = new Set<Config["locale"]>(["ar", "fr", "en"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag") ?? "";
  const localeParam = searchParams.get("locale") ?? "ar";
  if (!/^\d+$/.test(tag)) {
    return NextResponse.json({ error: "tag must be a numeric id" }, { status: 400 });
  }
  const locale = (LOCALES.has(localeParam as Config["locale"]) ? localeParam : "ar") as Config["locale"];

  const res = await getArticlesByTag(Number(tag), locale, 1, HOME_LATEST_NEWS_LIMIT);
  const articles: LeagueCardArticle[] = res.docs.map(toLeagueCard);
  return NextResponse.json({ articles });
}
