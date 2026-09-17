import { describe, it, expect } from "vitest";
import { isBrokenTaxonomySlug, repairTaxonomySlug, taxonomySlug, titleToSlug } from "../slugFromTitle";

describe("titleToSlug", () => {
  it("turns spaces into dashes", () => {
    expect(titleToSlug("Raja parts ways with coach")).toBe("raja-parts-ways-with-coach");
  });

  it("keeps Arabic letters and diacritics, spaces → dashes", () => {
    expect(titleToSlug("نصير مزراوي يعود")).toBe("نصير-مزراوي-يعود");
    expect(titleToSlug("لجنة التأديب تُصدر عقوبة")).toBe("لجنة-التأديب-تُصدر-عقوبة");
  });

  it("trims a trailing space (the bug that broke 394/395/396)", () => {
    expect(titleToSlug("الرجاء الرياضي يعلن ")).toBe("الرجاء-الرياضي-يعلن");
  });

  it("drops punctuation and collapses dashes", () => {
    expect(titleToSlug("Mazraoui returns, bolstering — the squad!")).toBe(
      "mazraoui-returns-bolstering-the-squad",
    );
  });

  it("collapses multiple spaces and strips edge dashes", () => {
    expect(titleToSlug("  hello   world  ")).toBe("hello-world");
  });
});

describe("isBrokenTaxonomySlug", () => {
  it("flags whitespace, including the trailing space 226 sitemap tags carried", () => {
    expect(isBrokenTaxonomySlug("محسن ياجور ")).toBe(true);
    expect(isBrokenTaxonomySlug("كأس العالم")).toBe(true);
  });

  it("flags percent-encoding, which never matches a decoded route param", () => {
    expect(isBrokenTaxonomySlug("%D9%85%D8%B2%D8%B1%D8%A7%D9%88%D9%8A")).toBe(true);
  });

  it("leaves working slugs alone, Arabic or ASCII, dots included", () => {
    expect(isBrokenTaxonomySlug("مزراوي")).toBe(false);
    expect(isBrokenTaxonomySlug("botola-pro-1")).toBe(false);
    expect(isBrokenTaxonomySlug("u.s.-touarga")).toBe(false);
  });
});

describe("repairTaxonomySlug", () => {
  it("trims and hyphenates a broken slug, keeping the Arabic", () => {
    expect(repairTaxonomySlug("محسن ياجور ")).toBe("محسن-ياجور");
    expect(repairTaxonomySlug("كأس العالم ")).toBe("كأس-العالم");
  });

  it("treats underscores as word separators, not punctuation to drop", () => {
    expect(repairTaxonomySlug("%d9%83%d8%a3%d8%b3_%d8%a3%d9%85%d9%85")).toBe("كأس-أمم");
  });

  it("decodes percent-encoding before cleaning", () => {
    expect(repairTaxonomySlug("%D9%85%D8%B2%D8%B1%D8%A7%D9%88%D9%8A")).toBe("مزراوي");
  });

  // A repair must never rewrite a URL that already works — that would break
  // it for Google, which is the opposite of the point.
  it("returns null for a slug that already resolves", () => {
    expect(repairTaxonomySlug("مزراوي")).toBeNull();
    expect(repairTaxonomySlug("u.s.-touarga")).toBeNull();
    expect(repairTaxonomySlug("botola-pro-1")).toBeNull();
  });
});

describe("taxonomySlug hook", () => {
  const run = (value: unknown, name?: string) =>
    (taxonomySlug as (args: Record<string, unknown>) => unknown)({
      value,
      siblingData: name === undefined ? {} : { name },
      originalDoc: {},
    });

  it("repairs a broken typed slug and keeps a working one verbatim", () => {
    expect(run("محسن ياجور ")).toBe("محسن-ياجور");
    expect(run("u.s.-touarga")).toBe("u.s.-touarga");
  });

  it("derives the slug from the name when left empty", () => {
    expect(run("", "كأس العالم")).toBe("كأس-العالم");
    expect(run(undefined, "Botola Pro 1")).toBe("botola-pro-1");
  });

  it("passes an empty value through when there is no name either", () => {
    expect(run("")).toBe("");
  });
});
