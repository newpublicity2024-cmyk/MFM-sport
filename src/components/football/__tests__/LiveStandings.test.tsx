import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { LiveStandings } from "@/components/football/LiveStandings";
import type { ApiStandingRow } from "@/lib/api-football/types";

const labels = {
  team: "Team", played: "P", won: "W", drawn: "D", lost: "L",
  goalsFor: "GF", goalsAgainst: "GA", goalDiff: "GD", points: "Pts", form: "Form",
};

function row(name: string, points: number): ApiStandingRow {
  return {
    rank: 1, team: { id: 1, name, logo: "" }, points, goalsDiff: 0, group: "",
    form: null, status: "", description: null,
    all: { played: 1, win: 1, draw: 0, lose: 0, goals: { for: 1, against: 0 } },
  };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });

describe("LiveStandings", () => {
  it("renders the initial standings", () => {
    render(<LiveStandings initial={[row("Alpha", 3)]} leagueId={1} season={2026} locale="en" labels={labels} live={false} />);
    expect(screen.getByText("Alpha")).toBeTruthy();
  });

  it("does not poll when not live", () => {
    render(<LiveStandings initial={[row("Alpha", 3)]} leagueId={1} season={2026} locale="en" labels={labels} live={false} pollMs={10} />);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("polls and updates when live", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ standings: [row("Beta", 6)] }),
    });
    render(<LiveStandings initial={[row("Alpha", 3)]} leagueId={1} season={2026} locale="en" labels={labels} live pollMs={10} />);
    await waitFor(() => expect(screen.getByText("Beta")).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith("/api/standings?league=1&season=2026", expect.anything());
  });
});
