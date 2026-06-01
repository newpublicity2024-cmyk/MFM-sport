import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../rate-limit";

describe("checkRateLimit", () => {
  it("allows requests when Upstash is not configured (no-op fallback)", async () => {
    const res = await checkRateLimit("test-key");
    expect(res.success).toBe(true);
  });
});
