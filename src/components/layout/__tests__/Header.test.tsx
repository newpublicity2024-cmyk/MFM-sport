import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Header } from "../Header";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/ar/",
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

// Mock @/i18n/routing (used by LanguageSwitcher)
vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["ar", "fr", "en"], defaultLocale: "ar" },
}));

// Mock LanguageSwitcher to avoid class-variance-authority / lucide-react chain
vi.mock("../LanguageSwitcher", () => ({
  LanguageSwitcher: ({ locale }: { locale: string }) => (
    <button data-testid="language-switcher">{locale.toUpperCase()}</button>
  ),
}));

// Mock MobileNav to avoid sheet / lucide-react chain
vi.mock("../MobileNav", () => ({
  MobileNav: ({ locale }: { locale: string }) => (
    <button data-testid="mobile-nav" aria-label="Menu" />
  ),
}));

describe("Header", () => {
  it("renders the MFM Sport logo", () => {
    render(<Header locale="ar" />);
    expect(screen.getByText("MFM")).toBeInTheDocument();
    expect(screen.getByText("Sport")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<Header locale="ar" />);
    const links = screen.getAllByRole("link");
    // Logo link + 5 nav links = at least 6
    expect(links.length).toBeGreaterThanOrEqual(6);
  });
});
