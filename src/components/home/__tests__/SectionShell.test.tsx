import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SectionShell } from "@/components/home/SectionShell";

describe("SectionShell", () => {
  it("renders its children", () => {
    const { getByText } = render(
      <SectionShell>
        <p>hello</p>
      </SectionShell>,
    );
    expect(getByText("hello")).toBeInTheDocument();
  });

  it("uses the white card surface by default", () => {
    const { container } = render(
      <SectionShell>
        <span />
      </SectionShell>,
    );
    const section = container.querySelector("section");
    expect(section).toHaveClass("bg-card");
    expect(section).toHaveClass("rounded-2xl");
  });

  it("uses the navy surface for variant=navy", () => {
    const { container } = render(
      <SectionShell variant="navy">
        <span />
      </SectionShell>,
    );
    const section = container.querySelector("section");
    expect(section).toHaveClass("bg-navy");
    expect(section).toHaveClass("text-navy-foreground");
  });

  it("merges a custom className", () => {
    const { container } = render(
      <SectionShell className="custom-x">
        <span />
      </SectionShell>,
    );
    expect(container.querySelector("section")).toHaveClass("custom-x");
  });
});
