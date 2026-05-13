import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeagueNewsSection } from "@/components/home/LeagueNewsSection";

describe("LeagueNewsSection", () => {
  it("defaults to the first league and shows its 4 articles", () => {
    render(
      <LeagueNewsSection
        title="By League"
        locale="en"
      />,
    );
    expect(screen.getByRole("heading", { name: "By League" })).toBeInTheDocument();
    // First league is "Botola Pro" — should be active
    expect(screen.getByRole("button", { name: /Botola Pro/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // 4 article cards visible
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });

  it("switches articles when a different league is clicked", () => {
    render(<LeagueNewsSection title="By League" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: /Premier League/ }));
    expect(screen.getByRole("button", { name: /Premier League/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Botola Pro/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // Should still show 4 articles, but with PL titles
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(4);
    expect(screen.getByText(/Arsenal close gap/)).toBeInTheDocument();
  });
});
