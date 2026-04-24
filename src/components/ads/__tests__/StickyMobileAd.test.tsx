import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const messages = {
  ads: { label: "Advertisement" },
  common: { close: "Close" },
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>,
  );
}

function mockSlots(clientId: string, slotId: string) {
  vi.doMock("@/lib/ads/slots", () => ({
    AD_SLOTS: {
      headerLeaderboard: "",
      inArticleMid: "",
      inArticleBottom: "",
      inGrid: "",
      stickyMobile: slotId,
    },
    ADSENSE_CLIENT_ID: clientId,
    isAdsEnabled: () => Boolean(clientId),
  }));
}

describe("StickyMobileAd", () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
    // jsdom lacks IntersectionObserver — AdSlot uses it for lazy loading.
    class IO {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
  });

  afterEach(() => {
    vi.doUnmock("@/lib/ads/slots");
    vi.unstubAllEnvs();
  });

  it("renders when not previously dismissed", async () => {
    mockSlots("ca-pub-1234", "5555");
    const { StickyMobileAd } = await import("../StickyMobileAd");
    renderWithIntl(<StickyMobileAd />);
    expect(screen.getByTestId("sticky-mobile-ad")).toBeInTheDocument();
  });

  it("hides itself when dismiss button is clicked and stores flag in sessionStorage", async () => {
    mockSlots("ca-pub-1234", "5555");
    const { StickyMobileAd } = await import("../StickyMobileAd");
    renderWithIntl(<StickyMobileAd />);
    fireEvent.click(screen.getByRole("button", { name: /close|dismiss/i }));
    expect(screen.queryByTestId("sticky-mobile-ad")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("ad-sticky-dismissed")).toBe("1");
  });

  it("does not render when sessionStorage flag is set", async () => {
    sessionStorage.setItem("ad-sticky-dismissed", "1");
    mockSlots("ca-pub-1234", "5555");
    const { StickyMobileAd } = await import("../StickyMobileAd");
    renderWithIntl(<StickyMobileAd />);
    expect(screen.queryByTestId("sticky-mobile-ad")).not.toBeInTheDocument();
  });
});
