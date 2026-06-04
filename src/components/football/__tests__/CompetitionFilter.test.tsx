import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompetitionFilter } from "@/components/football/CompetitionFilter";

const competitions = [
  { id: "a", name: "Botola Pro", apiFootballId: 200 },
  { id: "b", name: "Premier League", apiFootballId: 39 },
] as never;

describe("CompetitionFilter", () => {
  it("renders an 'All' chip plus one per competition", () => {
    render(
      <CompetitionFilter
        competitions={competitions}
        selectedLeague={null}
        date="2026-05-04"
        basePath="/en/matches"
        allLabel="All"
        locale="en"
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveTextContent("All");
    expect(links[1]).toHaveTextContent("Botola Pro");
  });

  it("sets aria-current on the selected league chip", () => {
    render(
      <CompetitionFilter
        competitions={competitions}
        selectedLeague="39"
        date="2026-05-04"
        basePath="/en/matches"
        allLabel="All"
        locale="en"
      />,
    );
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("Premier League");
  });

  it("sets aria-current on 'All' when no league selected", () => {
    render(
      <CompetitionFilter
        competitions={competitions}
        selectedLeague={null}
        date="2026-05-04"
        basePath="/en/matches"
        allLabel="All"
        locale="en"
      />,
    );
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveTextContent("All");
  });

  it("preserves date in chip hrefs", () => {
    render(
      <CompetitionFilter
        competitions={competitions}
        selectedLeague={null}
        date="2026-05-04"
        basePath="/en/matches"
        allLabel="All"
        locale="en"
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/en/matches?date=2026-05-04");
    expect(links[1]).toHaveAttribute("href", "/en/matches?date=2026-05-04&league=200");
  });
});
