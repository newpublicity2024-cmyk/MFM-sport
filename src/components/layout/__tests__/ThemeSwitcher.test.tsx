import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";

// Mock matchMedia for next-themes
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function wrap(ui: React.ReactElement) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {ui}
    </ThemeProvider>,
  );
}

describe("ThemeSwitcher", () => {
  it("renders the trigger with an accessible label", () => {
    wrap(<ThemeSwitcher />);
    expect(screen.getByRole("button", { name: /toggle theme/i })).toBeInTheDocument();
  });

  it("exposes a clickable dropdown trigger", () => {
    // Radix DropdownMenu uses pointer-capture APIs that jsdom does not implement,
    // so opening the menu via fireEvent.click does not reliably render the items.
    // The icon-based rendering and dropdown contents are verified by visual QA in Task 8.
    wrap(<ThemeSwitcher />);
    const trigger = screen.getByRole("button", { name: /toggle theme/i });
    expect(trigger).toBeInTheDocument();
    // The trigger should not be disabled, so users can interact with it.
    expect(trigger).not.toBeDisabled();
    // It should advertise itself as a popup trigger via aria-haspopup.
    expect(trigger).toHaveAttribute("aria-haspopup");
  });
});
