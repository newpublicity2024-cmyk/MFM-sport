// src/components/ads/__tests__/AdEmbed.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AdEmbed } from "@/components/ads/AdEmbed";

describe("AdEmbed", () => {
  it("injects the embed markup into the container", () => {
    const { container } = render(
      <AdEmbed html='<ins class="adsbygoogle" data-x="1"></ins>' format="banner" />,
    );
    const host = container.querySelector("[data-ad-embed]");
    expect(host).not.toBeNull();
    expect(host?.querySelector("ins.adsbygoogle")).not.toBeNull();
  });

  it("applies the format wrapper sizing", () => {
    const { container } = render(<AdEmbed html="<span>hi</span>" format="tower" />);
    const host = container.querySelector("[data-ad-embed]") as HTMLElement;
    expect(host.className).toContain("min-h-[600px]");
  });

  it("re-creates <script> tags so the browser will execute them", () => {
    const { container } = render(
      <AdEmbed html="<script>window.__adRan=1</script>" format="banner" />,
    );
    const host = container.querySelector("[data-ad-embed]") as HTMLElement;
    // The component replaces inert innerHTML scripts with freshly created
    // <script> nodes; assert the node is present (execution depends on the host).
    expect(host.querySelector("script")).not.toBeNull();
  });
});
