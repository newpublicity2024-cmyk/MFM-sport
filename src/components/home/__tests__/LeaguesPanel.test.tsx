import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeaguesPanel } from "@/components/home/LeaguesPanel";
import type { LeagueLite } from "@/lib/home/cards";

const leagues: LeagueLite[] = [
  { id: "a", name: "Alpha", logoUrl: "/a.png", apiFootballId: 1 },
  { id: "b", name: "Beta", logoUrl: "/b.png", apiFootballId: 2 },
];

describe("LeaguesPanel", () => {
  it("renders one button per league with its name", () => {
    render(<LeaguesPanel leagues={leagues} selectedId="a" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Beta/ })).toBeInTheDocument();
  });

  it("marks the selected league with aria-pressed=true", () => {
    render(<LeaguesPanel leagues={leagues} selectedId="b" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Beta/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the league id when clicked", () => {
    const onSelect = vi.fn();
    render(<LeaguesPanel leagues={leagues} selectedId="a" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Beta/ }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("renders names exactly as provided (already localized upstream)", () => {
    render(
      <LeaguesPanel
        leagues={[{ id: "ar", name: "البطولة الاحترافية", logoUrl: "/x.png", apiFootballId: 200 }]}
        selectedId="ar"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /البطولة/ })).toBeInTheDocument();
  });
});
