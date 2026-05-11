import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchLineup } from "@/components/football/MatchLineup";
import type { ApiLineup } from "@/lib/api-football/types";

const labels = {
  startingXI: "Starting XI",
  substitutes: "Substitutes",
  coach: "Coach",
  formation: "Formation",
};

const baseTeam = { id: 1, name: "Team A", logo: "/logo.png", colors: null };
const player = (id: number, name: string) => ({
  player: { id, name, number: id, pos: "M" },
});

describe("MatchLineup", () => {
  it("renders full lineup when all fields are present", () => {
    const lineup: ApiLineup = {
      team: baseTeam,
      formation: "4-3-3",
      startXI: [player(1, "Alpha"), player(2, "Bravo")],
      substitutes: [player(12, "Sub One")],
      coach: { id: 99, name: "Coach", photo: null },
    };

    render(<MatchLineup lineup={lineup} labels={labels} />);

    expect(screen.getByText("Team A")).toBeInTheDocument();
    expect(screen.getByText("Formation: 4-3-3")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Sub One")).toBeInTheDocument();
    expect(screen.getByText("Coach", { selector: "span" })).toBeInTheDocument();
  });

  it("does not crash when startXI is null", () => {
    const lineup = {
      team: baseTeam,
      formation: "4-4-2",
      startXI: null,
      substitutes: [player(12, "Sub One")],
      coach: { id: null, name: null, photo: null },
    } as unknown as ApiLineup;

    render(<MatchLineup lineup={lineup} labels={labels} />);

    expect(screen.getByText("Team A")).toBeInTheDocument();
    expect(screen.queryByText(labels.startingXI)).not.toBeInTheDocument();
    expect(screen.getByText("Sub One")).toBeInTheDocument();
  });

  it("does not crash when substitutes is null", () => {
    const lineup = {
      team: baseTeam,
      formation: "4-4-2",
      startXI: [player(1, "Alpha")],
      substitutes: null,
      coach: { id: null, name: null, photo: null },
    } as unknown as ApiLineup;

    render(<MatchLineup lineup={lineup} labels={labels} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText(labels.substitutes)).not.toBeInTheDocument();
  });

  it("does not crash when both lineup arrays are undefined", () => {
    const lineup = {
      team: baseTeam,
      formation: null,
      startXI: undefined,
      substitutes: undefined,
      coach: { id: null, name: null, photo: null },
    } as unknown as ApiLineup;

    render(<MatchLineup lineup={lineup} labels={labels} />);

    expect(screen.getByText("Team A")).toBeInTheDocument();
    expect(screen.queryByText(labels.startingXI)).not.toBeInTheDocument();
    expect(screen.queryByText(labels.substitutes)).not.toBeInTheDocument();
    expect(screen.queryByText(/Formation:/)).not.toBeInTheDocument();
  });
});
