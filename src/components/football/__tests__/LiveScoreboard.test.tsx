import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

const useFixtureMock = vi.fn();
vi.mock("@/hooks/useFixture", () => ({ useFixture: (...args: unknown[]) => useFixtureMock(...args) }));

import { LiveScoreboard } from "@/components/football/LiveScoreboard";

const messages = {
  match: {
    live: "LIVE",
    fullTime: "FT",
    status: {
      tbd: "TIME TBC", halfTime: "HT", extraTime: "ET", breakTime: "BREAK", penalties: "PENS",
      suspended: "SUSP", interrupted: "INT", fullTime: "FULL TIME", afterExtraTime: "AET",
      afterPenalties: "AFTER PENS", postponed: "POSTPONED", cancelled: "CANCELLED",
      abandoned: "ABANDONED", awarded: "AWARDED", walkover: "WALKOVER",
    },
  },
};

function wrap(ui: React.ReactElement) {
  return render(<NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>);
}

const baseFixture: any = {
  fixture: { id: 7, date: "2026-05-04T20:00:00Z", status: { short: "1H", elapsed: 23, long: "" }, venue: null, referee: null },
  league: { id: 1, name: "L", logo: "", country: "", flag: null, season: 2025, round: "" },
  teams: { home: { id: 1, name: "H", logo: "", winner: null }, away: { id: 2, name: "A", logo: "", winner: null } },
  goals: { home: 1, away: 0 },
  score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
};

describe("LiveScoreboard", () => {
  it("displays the live score and elapsed minute", () => {
    useFixtureMock.mockReturnValue({ fixture: baseFixture, isLoading: false, error: null });
    wrap(<LiveScoreboard initial={baseFixture} locale="en" />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText(/LIVE 23'/)).toBeInTheDocument();
  });

  it("calls useFixture with enabled=true when match is live", () => {
    useFixtureMock.mockReturnValue({ fixture: baseFixture, isLoading: false, error: null });
    wrap(<LiveScoreboard initial={baseFixture} locale="en" />);
    expect(useFixtureMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ enabled: true, intervalMs: 30000 }),
    );
  });

  it("passes enabled=true and kickoffTs so the hook self-governs (stops itself at full time)", () => {
    // Polling cadence is now the hook's responsibility (it stops at FT and waits
    // for a scheduled kickoff), so the component always enables it + passes kickoff.
    const finished: any = {
      ...baseFixture,
      fixture: { ...baseFixture.fixture, status: { short: "FT", elapsed: 90, long: "" } },
    };
    useFixtureMock.mockReturnValue({ fixture: finished, isLoading: false, error: null });
    wrap(<LiveScoreboard initial={finished} locale="en" />);
    expect(useFixtureMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ enabled: true, kickoffTs: expect.any(Number) }),
    );
    expect(screen.getByText("FULL TIME")).toBeInTheDocument();
  });

  const withStatus = (short: string, goals = { home: 0, away: 0 }): any => ({
    ...baseFixture,
    fixture: { ...baseFixture.fixture, status: { short, elapsed: null, long: "" } },
    goals,
  });

  it("shows the postponed label and no score for a postponed match (it is not a 0-0)", () => {
    useFixtureMock.mockReturnValue({ fixture: null, isLoading: false, error: null });
    const { container } = wrap(<LiveScoreboard initial={withStatus("PST")} locale="en" />);
    expect(screen.getByText("POSTPONED")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/0\s*-\s*0/);
    expect(container.querySelector("[data-phase='other']")).not.toBeNull();
  });

  it("shows the TBC label instead of a 00:00 kick-off for a TBD fixture", () => {
    useFixtureMock.mockReturnValue({ fixture: null, isLoading: false, error: null });
    const { container } = wrap(<LiveScoreboard initial={withStatus("TBD")} locale="en" />);
    expect(screen.getByText("TIME TBC")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/);
  });

  it("shows the kick-off time for a scheduled match", () => {
    useFixtureMock.mockReturnValue({ fixture: null, isLoading: false, error: null });
    const { container } = wrap(<LiveScoreboard initial={withStatus("NS")} locale="en" />);
    expect(container.textContent).toMatch(/\d{2}:\d{2}/);
    expect(screen.getByText("vs")).toBeInTheDocument();
  });

  it("names how a finished match ended", () => {
    useFixtureMock.mockReturnValue({ fixture: null, isLoading: false, error: null });
    wrap(<LiveScoreboard initial={withStatus("AET", { home: 2, away: 1 })} locale="en" />);
    expect(screen.getByText("AET")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("labels the break during a live match instead of a minute", () => {
    useFixtureMock.mockReturnValue({ fixture: null, isLoading: false, error: null });
    wrap(<LiveScoreboard initial={withStatus("HT", { home: 1, away: 0 })} locale="en" />);
    expect(screen.getByText("HT")).toBeInTheDocument();
  });

  it("no longer repeats the date and venue under the score (the details card has them)", () => {
    useFixtureMock.mockReturnValue({ fixture: null, isLoading: false, error: null });
    const withVenue: any = { ...withStatus("NS"), fixture: { ...withStatus("NS").fixture, venue: { id: 1, name: "Stade X", city: "Rabat" }, referee: "R. Ref" } };
    const { container } = wrap(<LiveScoreboard initial={withVenue} locale="en" />);
    expect(container.textContent).not.toContain("Stade X");
    expect(container.textContent).not.toContain("R. Ref");
  });
});
