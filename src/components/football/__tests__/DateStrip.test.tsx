import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateStrip } from "@/components/football/DateStrip";

// Mock next/navigation: useRouter throws an invariant in jsdom without an app router mount.
// The component only uses router.push inside the date input's onChange, which the tests don't trigger.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("DateStrip", () => {
  it("renders 7 day links centered on selected", () => {
    render(<DateStrip selected="2026-05-04" locale="en" basePath="/en/matches" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(7);
    expect(links[0]).toHaveAttribute("href", "/en/matches?date=2026-05-01");
    expect(links[3]).toHaveAttribute("href", "/en/matches?date=2026-05-04");
    expect(links[6]).toHaveAttribute("href", "/en/matches?date=2026-05-07");
  });

  it("marks the selected day as aria-current", () => {
    render(<DateStrip selected="2026-05-04" locale="en" basePath="/en/matches" />);
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveAttribute("href", "/en/matches?date=2026-05-04");
  });

  it("preserves the league query param when set", () => {
    render(<DateStrip selected="2026-05-04" locale="en" basePath="/en/matches" league="39" />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/en/matches?date=2026-05-01&league=39");
  });

  it("renders a date picker input bound to selected", () => {
    render(<DateStrip selected="2026-05-04" locale="en" basePath="/en/matches" />);
    const input = screen.getByLabelText(/date/i) as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-05-04");
  });
});
