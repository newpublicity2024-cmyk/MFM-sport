import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, beforeEach, vi } from "vitest";

const messages = { ads: { label: "Advertisement" } };

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>,
  );
}

describe("AdSlot", () => {
  beforeEach(() => {
    vi.resetModules();
    (window as any).adsbygoogle = [];
  });

  it("renders nothing when ADSENSE_CLIENT_ID is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "");
    const { AdSlot } = await import("../AdSlot");
    const { container } = renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" />,
    );
    expect(container.firstChild).toBeNull();
    vi.unstubAllEnvs();
  });

  it("renders nothing when slot ID is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-0000");
    const slotsModule = await import("../../../lib/ads/slots");
    slotsModule.AD_SLOTS.headerLeaderboard = "";
    const { AdSlot } = await import("../AdSlot");
    const { container } = renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" />,
    );
    expect(container.firstChild).toBeNull();
    vi.unstubAllEnvs();
  });

  it("renders ins element with ad-client and ad-slot attributes when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-1234");
    const slotsModule = await import("../../../lib/ads/slots");
    slotsModule.AD_SLOTS.headerLeaderboard = "9999";
    const { AdSlot } = await import("../AdSlot");
    renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" loading="eager" />,
    );
    const ins = document.querySelector("ins.adsbygoogle");
    expect(ins).not.toBeNull();
    expect(ins).toHaveAttribute("data-ad-client", "ca-pub-1234");
    expect(ins).toHaveAttribute("data-ad-slot", "9999");
    expect(ins).toHaveAttribute("data-ad-format", "auto");
    expect(ins).toHaveAttribute("data-full-width-responsive", "true");
    vi.unstubAllEnvs();
  });

  it("calls adsbygoogle.push immediately when loading is eager", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-1234");
    const slotsModule = await import("../../../lib/ads/slots");
    slotsModule.AD_SLOTS.headerLeaderboard = "9999";
    const pushSpy = vi.fn();
    (window as any).adsbygoogle = { push: pushSpy };
    const { AdSlot } = await import("../AdSlot");
    renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" loading="eager" />,
    );
    expect(pushSpy).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });
});
