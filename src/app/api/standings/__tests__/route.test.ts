import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-football/standings", () => ({
  getStandings: vi.fn().mockResolvedValue([{ rank: 1 }]),
}));

import { GET } from "@/app/api/standings/route";
import { getStandings } from "@/lib/api-football/standings";

describe("GET /api/standings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns standings for valid params", async () => {
    const res = await GET(new Request("http://x/api/standings?league=39&season=2025"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ standings: [{ rank: 1 }] });
    expect(getStandings).toHaveBeenCalledWith(39, 2025);
  });

  it("returns 400 when params are missing or non-numeric", async () => {
    const res = await GET(new Request("http://x/api/standings?league=abc"));
    expect(res.status).toBe(400);
    expect(getStandings).not.toHaveBeenCalled();
  });
});
