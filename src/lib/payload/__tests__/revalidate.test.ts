import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));

import { revalidatePath, revalidateTag } from "next/cache";
import {
  revalidateAdChange,
  revalidateArticleChange,
  revalidateCategoryChange,
} from "../revalidate";
import { ARTICLES_TAG, ADS_TAG, TAXONOMY_TAG, articleTag } from "../cache-tags";

const tagCalls = () => (revalidateTag as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
const pathCalls = () => (revalidatePath as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c.join(" "));

function req(findByIDResult: unknown) {
  return {
    payload: {
      findByID: vi.fn().mockResolvedValue(findByIDResult),
      logger: { error: vi.fn() },
    },
    locale: "ar",
  };
}

describe("revalidateArticleChange", () => {
  beforeEach(() => vi.clearAllMocks());

  // Every publish used to clear the whole `articles` tag, taking every cached
  // article doc with it. Now: lists via the shared tag, this article via its own.
  it("busts the lists tag and this article's own tag, not every article", async () => {
    const r = req({ slug: { ar: "الرجاء-يفوز", fr: "", en: undefined }, categories: [{ slug: "botola" }] });
    await (revalidateArticleChange as unknown as (a: unknown) => Promise<unknown>)({
      doc: { id: 7 },
      req: r,
      context: {},
    });
    expect(tagCalls()).toEqual([ARTICLES_TAG, articleTag("الرجاء-يفوز")]);
    expect(tagCalls()).not.toContain(TAXONOMY_TAG);
    expect(pathCalls()).toContain("/ar/articles/الرجاء-يفوز");
    expect(pathCalls()).toContain("/ar/category/botola");
  });

  it("does nothing during a bulk import", async () => {
    await (revalidateArticleChange as unknown as (a: unknown) => Promise<unknown>)({
      doc: { id: 7 },
      req: req({}),
      context: { disableRevalidate: true },
    });
    expect(tagCalls()).toEqual([]);
  });
});

describe("revalidateCategoryChange", () => {
  beforeEach(() => vi.clearAllMocks());

  // A rename shows on every article's badges; the cached article docs carry
  // TAXONOMY_TAG for exactly this.
  it("busts lists and the taxonomy tag", async () => {
    await (revalidateCategoryChange as unknown as (a: unknown) => Promise<unknown>)({
      doc: { slug: "botola" },
      req: req({}),
      context: {},
    });
    expect(tagCalls()).toEqual([ARTICLES_TAG, TAXONOMY_TAG]);
  });
});

describe("revalidateAdChange", () => {
  beforeEach(() => vi.clearAllMocks());

  // `revalidatePath("/", "layout")` discarded every ISR page on the site.
  it("busts the ads tag and the homepage, never the whole layout", async () => {
    await (revalidateAdChange as unknown as (a: unknown) => Promise<unknown>)({
      doc: { id: 1 },
      req: req({}),
    });
    expect(tagCalls()).toEqual([ADS_TAG]);
    expect(pathCalls()).toEqual(["/ar", "/fr", "/en"]);
    expect(pathCalls().some((c) => c.includes("layout"))).toBe(false);
  });
});
