import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeagueCarousel, type CarouselLeague } from "@/components/home/LeagueCarousel";

const leagues: CarouselLeague[] = [
  { slug: "botola-pro-1", name: "Botola Pro 1", logoUrl: "https://media.api-sports.io/football/leagues/200.png" },
  { slug: "bundesliga", name: "Bundesliga", logoUrl: "https://media.api-sports.io/football/leagues/78.png" },
  { slug: "premier-league", name: "Premier League", logoUrl: "https://media.api-sports.io/football/leagues/39.png" },
];

describe("LeagueCarousel", () => {
  it("renders one logo-only link per league, pointing at its competition page", () => {
    render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/en/competition/botola-pro-1");
    expect(links[0]).toHaveAccessibleName("Botola Pro 1");
    expect(links[0]).toHaveAttribute("title", "Botola Pro 1");
    expect(screen.queryByText("Botola Pro 1")).toBeNull();
    expect(screen.queryByText("Bundesliga")).toBeNull();
  });

  it("renders each league as a ~48px contained logo image", () => {
    const { container } = render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(3);
    imgs.forEach((img) => {
      expect(img.className).toContain("object-contain");
      expect(img.className).toContain("h-12");
      expect(img.className).toContain("w-12");
    });
  });

  it("is a no-scrollbar horizontal strip with 20px gaps", () => {
    const { container } = render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const nav = container.querySelector("nav") as HTMLElement;
    expect(nav.className).toContain("overflow-x-auto");
    expect(nav.className).toContain("no-scrollbar");
    expect(nav.className).toContain("gap-5");
  });

  it("labels the nav and builds locale-aware hrefs", () => {
    render(<LeagueCarousel leagues={leagues} locale="ar" label="البطولات" />);
    expect(screen.getByRole("navigation", { name: "البطولات" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bundesliga" })).toHaveAttribute(
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
