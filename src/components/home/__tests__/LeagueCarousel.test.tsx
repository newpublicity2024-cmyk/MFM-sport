import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeagueCarousel, type CarouselLeague } from "@/components/home/LeagueCarousel";

const leagues: CarouselLeague[] = [
  { slug: "botola-pro-1", name: "Botola Pro 1", logoUrl: "https://media.api-sports.io/football/leagues/200.png" },
  { slug: "bundesliga", name: "Bundesliga", logoUrl: "https://media.api-sports.io/football/leagues/78.png" },
  { slug: "premier-league", name: "Premier League", logoUrl: "https://media.api-sports.io/football/leagues/39.png" },
];

describe("LeagueCarousel", () => {
  it("renders one link per provided league, pointing at its competition page", () => {
    render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/en/competition/botola-pro-1");
    expect(links[0]).toHaveTextContent("Botola Pro 1");
    expect(screen.getByText("Bundesliga")).toBeInTheDocument();
  });

  it("labels the nav and builds locale-aware hrefs", () => {
    render(<LeagueCarousel leagues={leagues} locale="ar" label="البطولات" />);
    expect(screen.getByRole("navigation", { name: "البطولات" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bundesliga/ })).toHaveAttribute(
      "href",
      "/ar/competition/bundesliga",
    );
  });

  it("renders nothing when there are no leagues", () => {
    const { container } = render(
      <LeagueCarousel leagues={[]} locale="en" label="Leagues" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
