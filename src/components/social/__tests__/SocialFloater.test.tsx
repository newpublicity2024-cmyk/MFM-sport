// src/components/social/__tests__/SocialFloater.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import { SocialFloater } from "@/components/social/SocialFloater";

afterEach(() => {
  vi.restoreAllMocks();
});

function getMainButton(container: HTMLElement) {
  // The main Instagram trigger is the only <button> in the floater.
  return container.querySelector("button") as HTMLButtonElement;
}

describe("SocialFloater", () => {
  it("starts collapsed: dropdown hidden, main button not expanded", () => {
    const { container } = render(<SocialFloater />);
    const btn = getMainButton(container);
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    // No social links are reachable while collapsed.
    const menu = container.querySelector("[data-floater-menu]") as HTMLElement;
    expect(menu.getAttribute("aria-hidden")).toBe("true");
  });

  it("first click opens the menu showing YouTube, Facebook, X (Instagram NOT duplicated)", () => {
    const { container } = render(<SocialFloater />);
    fireEvent.click(getMainButton(container));

    expect(getMainButton(container).getAttribute("aria-expanded")).toBe("true");

    const menu = container.querySelector("[data-floater-menu]") as HTMLElement;
    const links = within(menu).getAllByRole("link");
    const labels = links.map((a) => a.getAttribute("aria-label"));
    expect(labels).toEqual(["YouTube", "Facebook", "X"]);
    // Instagram must not appear as a dropdown link.
    expect(labels).not.toContain("Instagram");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://youtube.com/@mfmsport1430",
      "https://facebook.com/Mfmsport.ma",
      "https://x.com/MfmSport",
    ]);
    links.forEach((a) => {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("second click on the main button opens Instagram and keeps the menu open", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(<SocialFloater />);
    const btn = getMainButton(container);

    fireEvent.click(btn); // open
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent.click(btn); // navigate
    expect(openSpy).toHaveBeenCalledWith(
      "https://instagram.com/mfmsportofficiel",
      "_blank",
      "noopener,noreferrer",
    );
    // Still open (NOT toggled closed).
    expect(getMainButton(container).getAttribute("aria-expanded")).toBe("true");
  });

  it("closes when clicking outside the floater", () => {
    const { container } = render(<SocialFloater />);
    fireEvent.click(getMainButton(container));
    expect(getMainButton(container).getAttribute("aria-expanded")).toBe("true");

    fireEvent.mouseDown(document.body);
    expect(getMainButton(container).getAttribute("aria-expanded")).toBe("false");
  });
});
