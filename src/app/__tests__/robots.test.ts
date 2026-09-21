import { describe, it, expect } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  const rules = robots().rules as { userAgent: string | string[]; disallow?: string | string[] }[];
  const everyone = rules.find((r) => r.userAgent === "*")!;
  const scrapers = rules.find((r) => Array.isArray(r.userAgent))!;

  it("keeps the matches page crawlable but closes its ?date= / ?league= URL space", () => {
    const disallow = everyone.disallow as string[];
    expect(disallow).toContain("/*?date=");
    expect(disallow).toContain("/*?league=");
    expect(disallow).toContain("/*&league=");
    expect(disallow).not.toContain("/ar/matches");
  });

  it("lists Meta's and Anthropic's training crawlers, not the preview/assistant agents", () => {
    const agents = scrapers.userAgent as string[];
    expect(agents).toContain("meta-externalagent");
    expect(agents).toContain("ClaudeBot");
    expect(agents).not.toContain("facebookexternalhit");
    expect(agents).not.toContain("Googlebot");
    expect(scrapers.disallow).toBe("/");
  });
});
