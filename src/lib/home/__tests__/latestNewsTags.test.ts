import { describe, it, expect } from "vitest";
import {
  chipsFromArticles,
  chipsFromSettings,
  resolveLatestNewsTags,
  MAX_DERIVED_TAG_CHIPS,
} from "@/lib/home/latestNewsTags";

const tag = (id: number, name: string) => ({ id, name, slug: `t-${id}` });

describe("chipsFromSettings", () => {
  it("keeps the admin's order and drops unpopulated or duplicate rows", () => {
    const chips = chipsFromSettings([
      { tag: tag(3, "المغرب") },
      { tag: 9 },
      { tag: tag(3, "المغرب") },
      { tag: tag(490, "البطولة إنوي") },
      { tag: null },
    ]);
    expect(chips.map((c) => c.id)).toEqual(["3", "490"]);
    expect(chips[0]).toEqual({ id: "3", name: "المغرب", slug: "t-3" });
  });

  it("returns [] for a missing list", () => {
    expect(chipsFromSettings(undefined)).toEqual([]);
  });
});

describe("chipsFromArticles", () => {
  it("orders tags by how many of the latest articles carry them, ties by first appearance", () => {
    const articles = [
      { tags: [tag(1, "A"), tag(2, "B")] },
      { tags: [tag(2, "B"), tag(3, "C")] },
      { tags: [tag(2, "B"), tag(1, "A"), tag(3, "C")] },
    ];
    expect(chipsFromArticles(articles).map((c) => c.name)).toEqual(["B", "A", "C"]);
  });

  it("drops tags carried by fewer articles than the threshold", () => {
    const articles = [{ tags: [tag(1, "A"), tag(2, "once")] }, { tags: [tag(1, "A")] }];
    expect(chipsFromArticles(articles).map((c) => c.name)).toEqual(["A"]);
  });

  it("caps the derived list", () => {
    const articles = Array.from({ length: 2 }, () => ({
      tags: Array.from({ length: 20 }, (_, i) => tag(i, `T${i}`)),
    }));
    expect(chipsFromArticles(articles)).toHaveLength(MAX_DERIVED_TAG_CHIPS);
  });

  it("ignores articles read at depth 0 (tags are bare ids)", () => {
    expect(chipsFromArticles([{ tags: [1, 2] }, { tags: [1] }])).toEqual([]);
  });
});

describe("resolveLatestNewsTags", () => {
  const latest = [{ tags: [tag(7, "derived")] }, { tags: [tag(7, "derived")] }];

  it("prefers the admin's list when it has entries", () => {
    const chips = resolveLatestNewsTags([{ tag: tag(1, "chosen") }], latest);
    expect(chips.map((c) => c.name)).toEqual(["chosen"]);
  });

  it("uses the site-wide ranking when the admin list is empty", () => {
    const site = [tag(9, "site-wide")].map((t) => ({ id: String(t.id), name: t.name, slug: t.slug }));
    expect(resolveLatestNewsTags([], latest, site).map((c) => c.name)).toEqual(["site-wide"]);
  });

  it("derives from the latest articles when both the admin list and the ranking are empty", () => {
    expect(resolveLatestNewsTags([], latest).map((c) => c.name)).toEqual(["derived"]);
    expect(resolveLatestNewsTags([], latest, []).map((c) => c.name)).toEqual(["derived"]);
  });
});
