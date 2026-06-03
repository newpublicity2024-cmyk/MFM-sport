"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AdSlot } from "./AdSlot";
import { useIsClient } from "@/hooks/useIsClient";

const DISMISS_KEY = "ad-sticky-dismissed";

export function StickyMobileAd() {
  const t = useTranslations("common");
  const isClient = useIsClient();
  const [userDismissed, setUserDismissed] = useState(false);

  // On the server or before hydration, hide the bar (isClient=false).
  // After hydration, show unless the user has dismissed this session or clicked ×.
  const dismissed =
    !isClient ||
    userDismissed ||
    (typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1");

  if (dismissed) return null;

  return (
    <div
      data-testid="sticky-mobile-ad"
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-card border-t border-border p-1"
    >
      <button
        type="button"
        aria-label={t("close")}
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setUserDismissed(true);
        }}
        className="absolute top-0 right-1 text-xs text-muted-foreground px-1"
      >
        ×
      </button>
      <AdSlot slotName="stickyMobile" format="sticky-mobile" loading="lazy" />
    </div>
  );
}
