import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { BrandLogo } from "../BrandLogo";

// Mock next/image to render a plain <img> with width/height attrs
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
    priority,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
    className?: string;
    priority?: boolean;
  }) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      data-priority={priority ? "true" : "false"}
    />
  ),
}));

describe("BrandLogo", () => {
  it("renders the brand mark with an accessible alt text", () => {
    render(<BrandLogo />);
    const img = screen.getByAltText("MFM Sport");
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("/images/mfm-sport-logo.png");
  });

  it("defaults to the md size (40x40)", () => {
    render(<BrandLogo />);
    const img = screen.getByAltText("MFM Sport");
    expect(img.getAttribute("width")).toBe("40");
    expect(img.getAttribute("height")).toBe("40");
  });

  it("renders the sm variant at 32x32", () => {
    render(<BrandLogo size="sm" />);
    const img = screen.getByAltText("MFM Sport");
    expect(img.getAttribute("width")).toBe("32");
    expect(img.getAttribute("height")).toBe("32");
  });

  it("renders the lg variant at 56x56", () => {
    render(<BrandLogo size="lg" />);
    const img = screen.getByAltText("MFM Sport");
    expect(img.getAttribute("width")).toBe("56");
    expect(img.getAttribute("height")).toBe("56");
  });

  it("passes the priority flag through to next/image", () => {
    render(<BrandLogo priority />);
    const img = screen.getByAltText("MFM Sport");
    expect(img.getAttribute("data-priority")).toBe("true");
  });

  it("merges an extra className with the size-based classes", () => {
    render(<BrandLogo className="ml-2" />);
    const img = screen.getByAltText("MFM Sport");
    expect(img.className).toContain("ml-2");
  });
});
