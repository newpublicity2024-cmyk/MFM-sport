import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

const useFixtureMock = vi.fn();
vi.mock("@/hooks/useFixture", () => ({ useFixture: (...args: unknown[]) => useFixtureMock(...args) }));

import { LiveScoreboard } from "@/components/football/LiveScoreboard";

const messages = { match: { live: "LIVE", fullTime: "FT" } };

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
    expect(screen.getByText("FT")).toBeInTheDocument();
  });
});
