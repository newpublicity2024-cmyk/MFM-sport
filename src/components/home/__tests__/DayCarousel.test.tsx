import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DayCarousel, shiftDate } from "@/components/home/DayCarousel";

const TODAY = "2026-09-17";

function renderStrip(locale: string, selected = TODAY, onSelect = vi.fn()) {
  return render(
    <DayCarousel selected={selected} today={TODAY} onSelect={onSelect} locale={locale} dateLabel="التاريخ" label="days" />,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("shiftDate", () => {
  it("crosses month and year boundaries in UTC", () => {
    expect(shiftDate("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDate("2027-01-01", -1)).toBe("2026-12-31");
  });
});

describe("DayCarousel", () => {
  it("renders 15 day pills centred on today, the selected one aria-current, in a slidable row with a date picker", () => {
    const { container } = renderStrip("ar");
    const strip = container.querySelector("[data-day-carousel]") as HTMLElement;
    const pills = strip.querySelectorAll("button");
    expect(pills.length).toBe(15);
    expect(pills[0]!.getAttribute("aria-label")).toBe("2026-09-10");
    expect(pills[14]!.getAttribute("aria-label")).toBe("2026-09-24");
    expect(screen.getByRole("button", { name: TODAY })).toHaveAttribute("aria-current", "date");
    expect(strip.className).toContain("overflow-x-auto");
    expect(strip.className).toContain("snap-x");
    expect(screen.getByLabelText("التاريخ")).toHaveValue(TODAY);
  });

  it("reports the picked day from a pill and from the date input", () => {
    const onSelect = vi.fn();
    renderStrip("ar", TODAY, onSelect);
    fireEvent.click(screen.getByRole("button", { name: "2026-09-20" }));
    expect(onSelect).toHaveBeenCalledWith("2026-09-20");
    fireEvent.change(screen.getByLabelText("التاريخ"), { target: { value: "2026-12-25" } });
    expect(onSelect).toHaveBeenCalledWith("2026-12-25");
  });

  it("re-centres on a picked day outside the strip", () => {
    const { container } = renderStrip("ar", "2026-12-25");
    const pills = container.querySelectorAll("[data-day-carousel] button");
    expect(pills[7]!.getAttribute("aria-label")).toBe("2026-12-25");
    expect(pills[7]).toHaveAttribute("aria-current", "date");
  });

  it("marks today with a dot even when another day is selected", () => {
    renderStrip("ar", "2026-09-20");
    const today = screen.getByRole("button", { name: TODAY });
    expect(today.querySelector("[aria-hidden]")).toBeTruthy();
    expect(today).not.toHaveAttribute("aria-current");
  });

  it("arrows are desktop-only and, in RTL, scroll in the mirrored physical direction", () => {
    const scrollBy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollBy", { value: scrollBy, configurable: true });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { value: 500, configurable: true });

    renderStrip("en");
    fireEvent.click(screen.getByRole("button", { name: "Scroll days to end" }));
    expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: 400 }));

    scrollBy.mockClear();
    renderStrip("ar");
    const [, arEnd] = screen.getAllByRole("button", { name: "Scroll days to end" });
    fireEvent.click(arEnd!);
    expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ left: -400 }));
    expect(arEnd!.className).toContain("hidden");
    expect(arEnd!.className).toContain("lg:flex");
  });

  it("arrows sit beside the strip in the flow, never over its first or last pill", () => {
    const { container } = renderStrip("ar");
    const strip = container.querySelector("[data-day-carousel]") as HTMLElement;
    const start = screen.getByRole("button", { name: "Scroll days to start" });
    const end = screen.getByRole("button", { name: "Scroll days to end" });
    expect(start.nextElementSibling).toBe(strip);
    expect(strip.nextElementSibling).toBe(end);
    expect(start.className).not.toMatch(/\babsolute\b/);
    expect(strip.className).not.toMatch(/px-9/);
  });
});
