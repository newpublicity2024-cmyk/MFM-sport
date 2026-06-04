import { describe, it, expect } from "vitest";
import { transliterateToArabic } from "@/lib/api-football/transliterate";

const ARABIC = /[؀-ۿ]/;
const LATIN = /[a-z]/i;

describe("transliterateToArabic", () => {
  it("renders readable Arabic for representative names (regression)", () => {
    expect(transliterateToArabic("Osasuna")).toBe("أوساسونا");
    expect(transliterateToArabic("Lionel Messi")).toBe("ليونيل ميسي");
    expect(transliterateToArabic("Juventus")).toBe("جوفينتوس");
    expect(transliterateToArabic("Real Sociedad")).toBe("ريال سوسييداد");
  });

  it("leaves no Latin letters behind and yields Arabic", () => {
    const samples = [
      "Cristiano Ronaldo",
      "Erling Haaland",
      "Wolverhampton Wanderers",
      "Atletico Madrid",
      "Mamelodi Sundowns",
      "TP Mazembe",
      "Bayer Leverkusen",
    ];
    for (const name of samples) {
      const out = transliterateToArabic(name);
      expect(out, `"${name}" still has Latin: "${out}"`).not.toMatch(LATIN);
      expect(out, `"${name}" produced no Arabic: "${out}"`).toMatch(ARABIC);
    }
  });

  it("preserves spaces between words", () => {
    expect(transliterateToArabic("Lionel Messi").split(" ")).toHaveLength(2);
  });

  it("preserves digits and hyphens", () => {
    expect(transliterateToArabic("Schalke 04")).toContain("04");
    expect(transliterateToArabic("Saint-Etienne")).toContain("-");
  });

  it("returns input unchanged when it already contains Arabic", () => {
    expect(transliterateToArabic("برشلونة")).toBe("برشلونة");
  });

  it("returns empty / non-Latin input unchanged", () => {
    expect(transliterateToArabic("")).toBe("");
    expect(transliterateToArabic("12-3")).toBe("12-3");
  });
});
