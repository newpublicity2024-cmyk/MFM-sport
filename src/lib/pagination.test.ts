import { describe, it, expect } from "vitest";
import { parsePageParam, pageHref } from "./pagination";

describe("parsePageParam", () => {
  it("defaults to 1 when undefined", () => {
    expect(parsePageParam(undefined)).toBe(1);
  });
  it("parses a positive integer string", () => {
    expect(parsePageParam("4")).toBe(4);
  });
  it("falls back to 1 for non-numeric input", () => {
    expect(parsePageParam("abc")).toBe(1);
  });
  it("falls back to 1 for zero or negative", () => {
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
  });
});

describe("pageHref", () => {
  it("returns the base path for page 1", () => {
    expect(pageHref("/ar/articles", 1)).toBe("/ar/articles");
  });
  it("appends /page/N for pages beyond 1", () => {
    expect(pageHref("/ar/articles", 2)).toBe("/ar/articles/page/2");
    expect(pageHref("/fr/category/foot", 5)).toBe("/fr/category/foot/page/5");
  });
});
