import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const messages = { ads: { label: "Advertisement" } };

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>,
  );
}

function mockSlots(clientId: string, slotId: string) {
  vi.doMock("@/lib/ads/slots", () => ({
    AD_SLOTS: {
      headerLeaderboard: slotId,
      inArticleMid: "",
      inArticleBottom: "",
      inGrid: "",
      stickyMobile: "",
    },
    ADSENSE_CLIENT_ID: clientId,
    isAdsEnabled: () => Boolean(clientId),
  }));
}

describe("AdSlot", () => {
  beforeEach(() => {
    vi.resetModules();
    (window as any).adsbygoogle = [];
  });

  afterEach(() => {
    vi.doUnmock("@/lib/ads/slots");
    vi.unstubAllEnvs();
  });

  it("renders nothing when ADSENSE_CLIENT_ID is empty", async () => {
    mockSlots("", "9999");
    const { AdSlot } = await import("../AdSlot");
    const { container } = renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when slot ID is empty", async () => {
    mockSlots("ca-pub-0000", "");
    const { AdSlot } = await import("../AdSlot");
    const { container } = renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders ins element with ad-client and ad-slot attributes when configured", async () => {
    mockSlots("ca-pub-1234", "9999");
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
  });

  it("calls adsbygoogle.push immediately when loading is eager", async () => {
    mockSlots("ca-pub-1234", "9999");
    const pushSpy = vi.fn();
    (window as any).adsbygoogle = { push: pushSpy };
    const { AdSlot } = await import("../AdSlot");
    renderWithIntl(
      <AdSlot slotName="headerLeaderboard" format="leaderboard" loading="eager" />,
    );
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });
});
