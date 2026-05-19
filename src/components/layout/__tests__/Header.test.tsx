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

// Mock BrandLogo to render a plain img the test can find by alt
vi.mock("../BrandLogo", () => ({
  BrandLogo: () => <img src="/images/mfm-sport-logo.png" alt="MFM Sport" />,
}));

// Mock ThemeSwitcher to avoid next-themes / dropdown chain
vi.mock("../ThemeSwitcher", () => ({
  ThemeSwitcher: () => <button data-testid="theme-switcher" aria-label="Toggle theme" />,
}));

describe("Header", () => {
  it("renders the MFM Sport logo", () => {
    render(<Header locale="ar" />);
    const logo = screen.getByAltText("MFM Sport");
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute("src")).toBe("/images/mfm-sport-logo.png");
  });

  it("renders navigation links", () => {
    render(<Header locale="ar" />);
    const links = screen.getAllByRole("link");
    // Logo link + 5 nav links = at least 6
    expect(links.length).toBeGreaterThanOrEqual(6);
  });
});
