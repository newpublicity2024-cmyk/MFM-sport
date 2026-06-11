import { describe, it, expect } from "vitest";
import { articlePaths, categoryPaths } from "./revalidate";

describe("articlePaths", () => {
  it("includes homepage + articles listing for every locale", () => {
    const paths = articlePaths({}, []);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/ar", "/fr", "/en",
        "/ar/articles", "/fr/articles", "/en/articles",
      ]),
    );
  });
  it("includes the localized article path when a slug exists for that locale", () => {
    const paths = articlePaths({ ar: "كرة", fr: "foot", en: "ball" }, []);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/ar/articles/كرة", "/fr/articles/foot", "/en/articles/ball",
      ]),
    );
  });
  it("includes category paths for every locale when category slugs are given", () => {
    const paths = articlePaths({}, ["foot", "tennis"]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/ar/category/foot", "/fr/category/tennis", "/en/category/foot",
      ]),
    );
  });
  it("does not duplicate paths", () => {
    const paths = articlePaths({ ar: "x" }, ["foot", "foot"]);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("categoryPaths", () => {
  it("includes homepage, articles listing, and the category page per locale", () => {
    expect(categoryPaths("foot")).toEqual(
      expect.arrayContaining([
        "/ar", "/ar/articles", "/ar/category/foot",
        "/fr/category/foot", "/en/category/foot",
      ]),
    );
  });
});
