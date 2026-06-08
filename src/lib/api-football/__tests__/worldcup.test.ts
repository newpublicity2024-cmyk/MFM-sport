import { describe, it, expect } from "vitest";
import { WORLD_CUP_LEAGUE_ID, WORLD_CUP_SEASON } from "@/lib/api-football/worldcup";

describe("world cup constants", () => {
  it("targets league 1, season 2026 (the 2026 World Cup)", () => {
    expect(WORLD_CUP_LEAGUE_ID).toBe(1);
    expect(WORLD_CUP_SEASON).toBe(2026);
  });
});
