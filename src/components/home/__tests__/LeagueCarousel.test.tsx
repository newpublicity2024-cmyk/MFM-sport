import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeagueCarousel } from "@/components/home/LeagueCarousel";

describe("LeagueCarousel", () => {
  it("renders one link per league pointing at the matches filter", () => {
    render(<LeagueCarousel locale="en" label="Leagues" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(6);
    expect(links[0]).toHaveAttribute("href", "/en/matches?league=200");
    expect(links[0]).toHaveTextContent("Botola Pro");
  });

  it("labels the nav and localizes league names", () => {
    render(<LeagueCarousel locale="ar" label="البطولات" />);
    expect(
      screen.getByRole("navigation", { name: "البطولات" }),
    ).toBeInTheDocument();
    expect(screen.getByText("البطولة الاحترافية")).toBeInTheDocument();
  });

  it("builds locale-aware hrefs", () => {
    render(<LeagueCarousel locale="fr" label="Championnats" />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/fr/matches?league=200");
  });
});
