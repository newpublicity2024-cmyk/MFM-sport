import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HomeMatchRow, type HomeMatchLabels } from "@/components/home/HomeMatchRow";
import type { ApiFixture } from "@/lib/api-football/types";

const LABELS: HomeMatchLabels = {
  liveNow: "Live Now",
  events: "Events",
  venue: "Venue",
  referee: "Referee",
  viewFullMatch: "View full match",
  loadingDetails: "Loading...",
  noEvents: "No events yet",
};

function makeFixture(overrides: Partial<ApiFixture["fixture"]> = {}): ApiFixture {
  return {
    fixture: {
      id: 101,
      date: "2026-06-03T19:00:00+00:00",
      timestamp: 1780000000,
      venue: { id: 1, name: "Stade Mohammed V", city: "Casablanca" },
      status: { long: "Second Half", short: "2H", elapsed: 67 },
      referee: "Said Kabbaj",
      ...overrides,
    },
    league: {
      id: 200, name: "Botola Pro", country: "Morocco", logo: "https://x/l.png",
      flag: null, season: 2026, round: "Regular Season - 28",
    },
    teams: {
      home: { id: 1, name: "Raja", logo: "https://x/h.png", winner: null },
      away: { id: 2, name: "Wydad", logo: "https://x/a.png", winner: null },
    },
    goals: { home: 1, away: 0 },
    score: {
      halftime: { home: 0, away: 0 }, fulltime: { home: null, away: null },
      extratime: { home: null, away: null }, penalty: { home: null, away: null },
    },
  };
}

describe("HomeMatchRow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders both team names and the score in the collapsed header", () => {
    render(<HomeMatchRow fixture={makeFixture()} locale="en" labels={LABELS} />);
    expect(screen.getByText("Raja")).toBeInTheDocument();
    expect(screen.getByText("Wydad")).toBeInTheDocument();
    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("fetches and renders match details when expanded", async () => {
    const detail = makeFixture();
    detail.events = [
      {
        time: { elapsed: 23, extra: null },
        team: { id: 1, name: "Raja", logo: "https://x/h.png" },
        player: { id: 9, name: "Hamid" },
        assist: { id: null, name: null },
        type: "Goal", detail: "Normal Goal", comments: null,
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fixture: detail }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomeMatchRow fixture={makeFixture()} locale="en" labels={LABELS} />);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/fixtures/101"),
    );
    await waitFor(() => expect(screen.getByText("Hamid")).toBeInTheDocument());
  });

  it("does not fetch a second time when toggled closed and open again", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fixture: makeFixture() }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HomeMatchRow fixture={makeFixture()} locale="en" labels={LABELS} />);
    const toggle = screen.getByRole("button");
    fireEvent.click(toggle); // open -> fetch
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle); // close
    fireEvent.click(toggle); // open again -> no refetch
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
