import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeagueCarousel, type CarouselLeague } from "@/components/home/LeagueCarousel";

const leagues: CarouselLeague[] = [
  { slug: "botola-pro-1", name: "Botola Pro 1", logoUrl: "https://media.api-sports.io/football/leagues/200.png" },
  { slug: "bundesliga", name: "Bundesliga", logoUrl: "https://media.api-sports.io/football/leagues/78.png" },
  { slug: "premier-league", name: "Premier League", logoUrl: "https://media.api-sports.io/football/leagues/39.png" },
];

describe("LeagueCarousel", () => {
  it("renders one link per league with logo, name, and competition href", () => {
    render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/en/competition/botola-pro-1");
    expect(links[0]).toHaveAccessibleName("Botola Pro 1");
  });

  it("renders the name in a desktop-only span (hidden on mobile)", () => {
    render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const nameEl = screen.getByText("Bundesliga");
    expect(nameEl.className).toContain("hidden");
    expect(nameEl.className).toContain("lg:inline");
  });

  it("renders responsive logos (48px mobile, 20px desktop, contained)", () => {
    const { container } = render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(3);
    imgs.forEach((img) => {
      expect(img.className).toContain("object-contain");
      expect(img.className).toContain("h-12");
      expect(img.className).toContain("lg:h-5");
    });
  });

  it("has desktop-only prev/next arrows that scroll the strip", () => {
    const scrollBy = vi.fn();
    // jsdom doesn't implement scrollBy; stub it on the element prototype.
    (HTMLElement.prototype as unknown as { scrollBy: unknown }).scrollBy = scrollBy;
    render(<LeagueCarousel leagues={leagues} locale="en" label="Leagues" />);
    const left = screen.getByRole("button", { name: /left/i });
    const right = screen.getByRole("button", { name: /right/i });
    expect(left.parentElement?.className).toContain("lg:flex");
    expect(right.parentElement?.className).toContain("lg:flex");
    fireEvent.click(right);
    fireEvent.click(left);
    expect(scrollBy).toHaveBeenCalledTimes(2);
    for (const call of scrollBy.mock.calls) {
      expect(typeof call[0].left).toBe("number");
    }
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
