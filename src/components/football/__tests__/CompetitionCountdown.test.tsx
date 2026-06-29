import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CompetitionCountdown } from "@/components/football/CompetitionCountdown";

const labels = { startsIn: "Starts in", firstMatch: "First match", days: "d", hours: "h", minutes: "m", seconds: "s" };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CompetitionCountdown", () => {
  it("renders the remaining days for a future target", () => {
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    render(<CompetitionCountdown targetIso="2026-06-11T18:00:00Z" locale="en" labels={labels} />);
    expect(screen.getByText(/Starts in/)).toBeTruthy();
    expect(screen.getByText(/10d/)).toBeTruthy();
  });

  it("shows the kickoff date", () => {
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    render(<CompetitionCountdown targetIso="2026-06-11T18:00:00Z" locale="en" labels={labels} />);
    expect(screen.getByText(/First match/)).toBeTruthy();
  });
});
