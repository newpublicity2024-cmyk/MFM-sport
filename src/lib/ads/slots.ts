export type SlotFormat = "leaderboard" | "in-article" | "in-grid" | "sticky-mobile";

export type SlotName =
  | "headerLeaderboard"
  | "inArticleMid"
  | "inArticleBottom"
  | "inGrid"
  | "stickyMobile";

// AdSense slot IDs — fill these in from the AdSense dashboard after site approval.
// Each must be a string like "1234567890". Empty string disables the slot.
export const AD_SLOTS: Record<SlotName, string> = {
  headerLeaderboard: "",
  inArticleMid: "",
  inArticleBottom: "",
  inGrid: "",
  stickyMobile: "",
};

export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "";

export function isAdsEnabled(): boolean {
  return Boolean(ADSENSE_CLIENT_ID);
}
