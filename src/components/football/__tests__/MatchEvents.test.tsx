import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the people dictionary so the Arabic path is verified independently of the
// real (curated) data, which lands in Task 10.
vi.mock("@/lib/api-football/dictionaries/people.ar", () => ({
  PEOPLE_AR: { 100: "محمد صلاح" },
}));

import { MatchEvents } from "@/components/football/MatchEvents";

const events = [
  {
    time: { elapsed: 10, extra: null },
    team: { id: 1, name: "T", logo: "" },
    player: { id: 999999, name: "Latin Player" },
    assist: { id: null, name: null },
    type: "Goal",
    detail: "Normal Goal",
    comments: null,
  },
] as never;

const mappedEvents = [
  {
    time: { elapsed: 22, extra: null },
    team: { id: 1, name: "T", logo: "" },
    player: { id: 100, name: "Mohamed Salah" },
    assist: { id: null, name: null },
    type: "Goal",
    detail: "Normal Goal",
    comments: null,
  },
] as never;

describe("MatchEvents", () => {
  it("renders Arabic player name when mapped and locale=ar", () => {
    render(<MatchEvents events={mappedEvents} homeTeamId={1} locale="ar" />);
    expect(screen.getByText("محمد صلاح")).toBeInTheDocument();
  });
  it("renders Latin player name when no ar mapping (locale=ar)", () => {
    render(<MatchEvents events={events} homeTeamId={1} locale="ar" />);
    expect(screen.getByText("Latin Player")).toBeInTheDocument();
  });
  it("renders Latin player name for fr", () => {
    render(<MatchEvents events={events} homeTeamId={1} locale="fr" />);
    expect(screen.getByText("Latin Player")).toBeInTheDocument();
  });
});
