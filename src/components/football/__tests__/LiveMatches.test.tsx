import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { LiveMatches } from "@/components/football/LiveMatches";
import type { ApiFixture } from "@/lib/api-football/types";

function fixture(id: number, leagueId: number, home: string): ApiFixture {
  return {
    fixture: { id, date: "2026-06-11T18:00:00Z", timestamp: 0, venue: null, status: { long: "First Half", short: "1H", elapsed: 10 }, referee: null },
    league: { id: leagueId, name: "WC", country: "World", logo: "", flag: null, season: 2026, round: "Group" },
    teams: { home: { id: 1, name: home, logo: "", winner: null }, away: { id: 2, name: "Away", logo: "", winner: null } },
    goals: { home: 1, away: 0 },
    score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
  };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });

describe("LiveMatches", () => {
  it("renders live fixtures filtered to the league and shows header", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ fixtures: [fixture(10, 1, "Alpha"), fixture(11, 99, "Other")] }),
    });
    render(<LiveMatches leagueId={1} locale="en" title="Live now" pollMs={10} />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeTruthy());
    expect(screen.queryByText("Other")).toBeNull();
    expect(screen.getByText("Live now")).toBeTruthy();
  });

  it("renders nothing (no header) when live poll returns only out-of-league fixtures", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ fixtures: [fixture(11, 99, "Other")] }),
    });
    render(<LiveMatches leagueId={1} locale="en" title="Live now" pollMs={10} />);
    await waitFor(() => expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0));
    expect(screen.queryByText("Live now")).toBeNull();
    expect(screen.queryByText("Other")).toBeNull();
  });
});
