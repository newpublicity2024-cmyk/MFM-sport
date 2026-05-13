import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeaguesPanel } from "@/components/home/LeaguesPanel";
import type { MockLeague } from "@/lib/home/mockLeagueNews";

const leagues: MockLeague[] = [
  { id: "a", name: { en: "Alpha", ar: "ألفا", fr: "Alpha" }, logoUrl: "/a.png" },
  { id: "b", name: { en: "Beta", ar: "بيتا", fr: "Beta" }, logoUrl: "/b.png" },
];

describe("LeaguesPanel", () => {
  it("renders one button per league with localized name", () => {
    render(
      <LeaguesPanel leagues={leagues} selectedId="a" locale="en" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Beta/ })).toBeInTheDocument();
  });

  it("marks the selected league with aria-pressed=true", () => {
    render(
      <LeaguesPanel leagues={leagues} selectedId="b" locale="en" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /Beta/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the league id when clicked", () => {
    const onSelect = vi.fn();
    render(
      <LeaguesPanel leagues={leagues} selectedId="a" locale="en" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Beta/ }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("displays Arabic names when locale=ar", () => {
    render(
      <LeaguesPanel leagues={leagues} selectedId="a" locale="ar" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /ألفا/ })).toBeInTheDocument();
  });
});
