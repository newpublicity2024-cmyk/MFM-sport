import { describe, it, expect } from "vitest";
import { titleToSlug } from "../slugFromTitle";

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
